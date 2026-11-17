# Lee el hardware del PC y la salud de los discos.
# Ojo: PowerShell no distingue mayúsculas ($P y $p serían la misma variable)
param([Alias('P')][string]$EntradaB64)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $EntradaB64

Send-Progress 5 'Leyendo el procesador y la memoria...' 'Reading CPU and memory...'
$cpu = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
$cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
$osI = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
$board = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue
$bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
$mem = @(Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue)

$ntVer = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction SilentlyContinue
$build = [int]$osI.BuildNumber
$osName = [string]$osI.Caption
$displayVer = [string]$ntVer.DisplayVersion

Send-Progress 30 'Leyendo la tarjeta gráfica...' 'Reading graphics card...'
$gpus = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -and $_.Name -notmatch 'Basic Display|Remote|Virtual|Parsec|Meta|Mirage|DisplayLink|Indirect'
} | ForEach-Object {
    $vram = [int64]0
    try { if ($_.AdapterRAM -gt 0) { $vram = [int64][uint32]$_.AdapterRAM } } catch {}
    $vendor = 'otro'
    if ($_.Name -match 'NVIDIA|GeForce|RTX|GTX|Quadro') { $vendor = 'nvidia' }
    elseif ($_.Name -match 'AMD|Radeon') { $vendor = 'amd' }
    elseif ($_.Name -match 'Intel') { $vendor = 'intel' }
    @{ nombre = $_.Name; fabricante = $vendor; driver = $_.DriverVersion; fechaDriver = (Format-WmiDate $_.DriverDate); vram = $vram; temp = $null }
})

# Datos extra de NVIDIA (temperatura y VRAM real) si su herramienta está instalada
$smi = Join-Path $env:windir 'System32\nvidia-smi.exe'
if (Test-Path -LiteralPath $smi) {
    try {
        $out = & $smi --query-gpu=name,temperature.gpu,memory.total,driver_version --format=csv,noheader,nounits 2>$null
        foreach ($line in @($out)) {
            $f = $line -split ',\s*'
            foreach ($g in $gpus) {
                if ($g.fabricante -eq 'nvidia' -and $g.nombre -like ('*' + ($f[0] -replace 'NVIDIA ', '') + '*')) {
                    $g.temp = [int]$f[1]; $g.vram = [int64]$f[2] * 1MB; $g.versionNvidia = $f[3]
                }
            }
        }
    } catch {}
}

Send-Progress 50 'Revisando la salud de los discos...' 'Checking disk health...'
$disks = @()
try {
    $disks = @(Get-PhysicalDisk -ErrorAction Stop | ForEach-Object {
        $rel = $null
        try { $rel = $_ | Get-StorageReliabilityCounter -ErrorAction Stop } catch {}
        $media = [string]$_.MediaType
        if ($_.BusType -eq 'NVMe') { $media = 'NVMe' }
        @{
            nombre      = $_.FriendlyName
            tipo        = $media
            bus         = [string]$_.BusType
            tamano      = [int64]$_.Size
            salud       = [string]$_.HealthStatus
            estado      = (@($_.OperationalStatus) -join ', ')
            desgaste    = $(if ($rel -and $rel.Wear -ne $null) { [int]$rel.Wear } else { $null })
            temperatura = $(if ($rel -and $rel.Temperature) { [int]$rel.Temperature } else { $null })
            horas       = $(if ($rel -and $rel.PowerOnHours) { [int]$rel.PowerOnHours } else { $null })
            errores     = $(if ($rel) { [int]$rel.ReadErrorsUncorrected + [int]$rel.WriteErrorsUncorrected } else { $null })
        }
    })
} catch {
    $disks = @(Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | ForEach-Object {
        @{ nombre = $_.Model; tipo = ''; bus = $_.InterfaceType; tamano = [int64]$_.Size; salud = $(if ($_.Status -eq 'OK') { 'Healthy' } else { [string]$_.Status }); estado = $_.Status; desgaste = $null; temperatura = $null; horas = $null; errores = $null }
    })
}

$volumes = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction SilentlyContinue | ForEach-Object {
    @{ letra = $_.DeviceID; etiqueta = $_.VolumeName; total = [int64]$_.Size; libre = [int64]$_.FreeSpace }
})

Send-Progress 75 'Leyendo temperatura y batería...' 'Reading temperature and battery...'
$cpuTemp = $null
try {
    $tz = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | Select-Object -First 1
    if ($tz -and $tz.CurrentTemperature -gt 0) {
        $c = [math]::Round(($tz.CurrentTemperature / 10) - 273.15)
        if ($c -gt 10 -and $c -lt 120) { $cpuTemp = [int]$c }
    }
} catch {}

$battery = $null
$b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
if ($b) {
    $battery = @{ carga = [int]$b.EstimatedChargeRemaining; estado = [int]$b.BatteryStatus }
    try {
        $full = (Get-CimInstance -Namespace root/wmi -ClassName BatteryFullChargedCapacity -ErrorAction Stop | Select-Object -First 1).FullChargedCapacity
        $design = (Get-CimInstance -Namespace root/wmi -ClassName BatteryStaticData -ErrorAction Stop | Select-Object -First 1).DesignedCapacity
        if ($full -and $design) { $battery.salud = [int](100 * $full / $design) }
    } catch {}
}

$uptimeDays = 0
try { $uptimeDays = [math]::Round(((Get-Date) - $osI.LastBootUpTime).TotalDays, 1) } catch {}

Send-Progress 100 'Listo' 'Done'
Send-Result @{
    equipo   = @{ fabricante = $cs.Manufacturer; modelo = $cs.Model; nombre = $env:COMPUTERNAME }
    sistema  = @{ nombre = $osName; version = $displayVer; build = $build; arquitectura = $osI.OSArchitecture; diasEncendido = $uptimeDays }
    cpu      = @{ nombre = ([string]$cpu.Name).Trim(); nucleos = [int]$cpu.NumberOfCores; hilos = [int]$cpu.NumberOfLogicalProcessors; mhz = [int]$cpu.MaxClockSpeed; temp = $cpuTemp }
    ram      = @{ total = [int64]$cs.TotalPhysicalMemory; libre = [int64]$osI.FreePhysicalMemory * 1024; modulos = $mem.Count; velocidad = [int](($mem | Measure-Object -Property Speed -Maximum).Maximum) }
    placa    = @{ fabricante = $board.Manufacturer; modelo = $board.Product }
    bios     = @{ version = $bios.SMBIOSBIOSVersion; fecha = (Format-WmiDate $bios.ReleaseDate); fabricante = $bios.Manufacturer }
    gpus     = $gpus
    discos   = $disks
    unidades = $volumes
    bateria  = $battery
}
