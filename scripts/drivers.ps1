# Revisa los drivers instalados y los dispositivos con problemas.
# Acciones: revisar, respaldar, reparar
# Ojo: PowerShell no distingue mayúsculas ($P y $p serían la misma variable)
param([Alias('P')][string]$EntradaB64)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $EntradaB64

if ($p.accion -eq 'respaldar') {
    Send-Progress 10 'Haciendo copia de tus drivers actuales (puede tardar unos minutos)...' 'Backing up your current drivers (may take a few minutes)...'
    $dest = Join-Path (Get-RLFolder 'RespaldoDrivers') (Get-Date -Format 'yyyy-MM-dd_HHmm')
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    $ok = $false; $msg = ''
    try {
        $null = & pnputil.exe /export-driver * $dest 2>&1
        $ok = (@(Get-ChildItem -LiteralPath $dest -Recurse -Filter *.inf -ErrorAction SilentlyContinue).Count -gt 0)
    } catch { $msg = $_.Exception.Message }
    Write-RLLog ('Respaldo de drivers en ' + $dest + ': ' + $ok)
    Send-Progress 100 'Listo' 'Done'
    Send-Result @{ ok = $ok; carpeta = $dest; tamano = (Get-PathSize $dest); mensaje = $msg }
    return
}

if ($p.accion -eq 'reparar') {
    # Intenta arreglar un dispositivo con error, de lo más suave a lo más fuerte, y para en cuanto funciona:
    #  1) apagarlo y encenderlo  2) reinstalar su driver (solo aparatos externos o no críticos)  3) volver a detectar el hardware
    # Nunca borra drivers del sistema ni toca discos, procesador, placa base ni la tarjeta gráfica.
    $id = [string]$p.id
    $dev = Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.DeviceID -eq $id } | Select-Object -First 1
    if (-not $dev) { Send-Result @{ ok = $false; mensaje = 'Ese dispositivo ya no está conectado.' }; return }
    $nombre = $(if ($dev.Name) { [string]$dev.Name } else { $id })
    $clase = [string]$dev.PNPClass
    $antes = [int]$dev.ConfigManagerErrorCode
    if ($antes -eq 0) { Send-Result @{ ok = $true; antes = 0; despues = 0; pasos = @(); mensaje = 'Ya funciona bien.' }; return }
    $criticas = '^(System|Computer|Processor|SCSIAdapter|HDC|DiskDrive|Volume|VolumeSnapshot|Display|Firmware|SecurityDevices|Battery|Net)$'
    $reinstalable = '^(USB|HIDClass|Bluetooth|Media|AudioEndpoint|Camera|Image|Mouse|Keyboard|XnaComposite|XboxComposite|Biometric|Ports|Printer|SoftwareDevice|Sensor|WPD|SmartCardReader|MultiFunction|)$'
    $pasos = New-Object System.Collections.Generic.List[string]
    function Estado { $d = Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.DeviceID -eq $id } | Select-Object -First 1; if ($d) { [int]$d.ConfigManagerErrorCode } else { -1 } }
    function PnpUtil([string[]]$a) {
        try {
            $pr = Start-Process -FilePath "$env:SystemRoot\System32\pnputil.exe" -ArgumentList $a -WindowStyle Hidden -PassThru
            if (-not $pr.WaitForExit(90000)) { try { $pr.Kill() } catch {}; return 9999 }
            return $pr.ExitCode
        } catch { return 9998 }
    }
    $ahora = $antes
    if ($clase -notmatch $criticas) {
        Send-Progress 20 ('Apagando y encendiendo ' + $nombre + '...') ('Turning ' + $nombre + ' off and on...')
        $c1 = PnpUtil @('/disable-device', ('"' + $id + '"'))
        Start-Sleep -Seconds 2
        $c2 = PnpUtil @('/enable-device', ('"' + $id + '"'))
        if ($c1 -ne 0 -or $c2 -ne 0) {
            # Windows antiguo sin esas opciones de pnputil: se usa el método clásico
            try { Disable-PnpDevice -InstanceId $id -Confirm:$false -ErrorAction Stop; Start-Sleep -Seconds 2; Enable-PnpDevice -InstanceId $id -Confirm:$false -ErrorAction Stop } catch { }
        }
        Start-Sleep -Seconds 4
        $ahora = Estado; $pasos.Add('reiniciar')
    }
    if ($ahora -ne 0 -and $clase -match $reinstalable) {
        Send-Progress 50 ('Reinstalando el driver de ' + $nombre + '...') ('Reinstalling the driver of ' + $nombre + '...')
        $null = PnpUtil @('/remove-device', ('"' + $id + '"'))
        Start-Sleep -Seconds 2
        $null = PnpUtil @('/scan-devices')
        Start-Sleep -Seconds 6
        $ahora = Estado; $pasos.Add('reinstalar')
    }
    if ($ahora -ne 0) {
        Send-Progress 80 'Buscando cambios de hardware...' 'Scanning for hardware changes...'
        $null = PnpUtil @('/scan-devices')
        Start-Sleep -Seconds 5
        $ahora = Estado; $pasos.Add('detectar')
    }
    # -1: el aparato cambió de identificador al reinstalarse; se busca otra vez por nombre
    if ($ahora -eq -1) {
        $n2 = Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq $nombre } | Select-Object -First 1
        $ahora = $(if ($n2) { [int]$n2.ConfigManagerErrorCode } else { -1 })
    }
    $ok = ($ahora -eq 0)
    Write-RLLog ('Arreglar dispositivo ' + $nombre + ' (' + $clase + ', código ' + $antes + '): ' + ($pasos -join '+') + ' -> ' + $(if ($ok) { 'funciona' } else { 'código ' + $ahora }))
    Send-Progress 100 'Listo' 'Done'
    Send-Result @{ ok = $ok; antes = $antes; despues = $ahora; pasos = $pasos.ToArray(); nombre = $nombre; clase = $clase; critico = [bool]($clase -match $criticas) }
    return
}

Send-Progress 10 'Leyendo los drivers instalados...' 'Reading installed drivers...'
$important = 'DISPLAY|NET|MEDIA|SYSTEM|HDC|SCSIADAPTER|BLUETOOTH|USB|AUDIOENDPOINT|CAMERA|BIOMETRIC|MOUSE|KEYBOARD|HIDCLASS'
$drivers = @(Get-CimInstance Win32_PnPSignedDriver -ErrorAction SilentlyContinue | Where-Object { $_.DeviceName -and $_.DriverVersion } | ForEach-Object {
    $prov = [string]$_.DriverProviderName
    # Los drivers que trae Windows de serie llevan fechas de relleno (1968, 2006...): no son fechas reales
    $f = Format-WmiDate $_.DriverDate
    $gen = ($prov -match '^Microsoft' -or [string]$_.Manufacturer -match '^\(Standard|^Microsoft|^Generic|^\(Estándar')
    $sinFecha = (-not $f) -or ($f -lt '2000') -or ($gen -and $f -le '2006-06-21')
    @{
        dispositivo = $_.DeviceName
        clase       = [string]$_.DeviceClass
        fabricante  = [string]$_.Manufacturer
        proveedor   = $prov
        version     = $_.DriverVersion
        fecha       = $(if ($sinFecha) { '' } else { $f })
        deWindows   = [bool]($gen -and $sinFecha)
        inf         = $_.InfName
        firmado     = [bool]$_.IsSigned
        generico    = $gen
        importante  = ([string]$_.DeviceClass -match $important)
    }
})

Send-Progress 60 'Buscando dispositivos con problemas...' 'Looking for devices with problems...'
$problems = @(Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.ConfigManagerErrorCode -and $_.ConfigManagerErrorCode -ne 0 -and $_.ConfigManagerErrorCode -ne 22 } | ForEach-Object {
    @{ dispositivo = $(if ($_.Name) { $_.Name } else { $_.DeviceID }); codigo = [int]$_.ConfigManagerErrorCode; clase = [string]$_.PNPClass; id = $_.DeviceID }
})

$backups = @(Get-ChildItem -LiteralPath (Get-RLFolder 'RespaldoDrivers') -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | ForEach-Object { $_.Name })

Send-Progress 100 'Listo' 'Done'
Send-Result @{ drivers = $drivers; problemas = $problems; respaldos = $backups }
