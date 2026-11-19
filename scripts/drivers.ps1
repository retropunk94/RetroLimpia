# Revisa los drivers instalados y los dispositivos con problemas.
# Acciones: revisar, respaldar
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
