# Mide el consumo real de RetroLimpia para fijar el "presupuesto de rendimiento".
# Uso: powershell -ExecutionPolicy Bypass -File medir-rendimiento.ps1 [-Exe "D:\Retrolimpia\RetroLimpia.exe"]
# No cambia nada en el PC: abre RetroLimpia, mide y lo vuelve a cerrar.
param([string]$Exe = '')

$ErrorActionPreference = 'SilentlyContinue'
if (-not $Exe) {
    $k = Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' |
        Where-Object { $_.DisplayName -like 'RetroLimpia*' } | Select-Object -First 1
    if ($k.InstallLocation) { $Exe = Join-Path $k.InstallLocation 'RetroLimpia.exe' }
    elseif ($k.UninstallString) { $Exe = Join-Path (Split-Path ($k.UninstallString.Trim('"').Split('"')[0])) 'RetroLimpia.exe' }
}
if (-not (Test-Path -LiteralPath $Exe)) { Write-Output "No encuentro RetroLimpia.exe ($Exe)"; exit 1 }

function Total {
    $ps = @(Get-Process -Name 'RetroLimpia' -ErrorAction SilentlyContinue)
    [pscustomobject]@{
        procesos = $ps.Count
        ramMB    = [math]::Round((($ps | Measure-Object WorkingSet64 -Sum).Sum) / 1MB, 1)
        privMB   = [math]::Round((($ps | Measure-Object PrivateMemorySize64 -Sum).Sum) / 1MB, 1)
        cpuSeg   = [math]::Round((($ps | Measure-Object CPU -Sum).Sum), 2)
        ventana  = [bool]($ps | Where-Object { $_.MainWindowHandle -ne 0 })
    }
}

$yaAbierto = (Total).procesos -gt 0
if ($yaAbierto) { Write-Output 'RetroLimpia ya estaba abierto: cierralo y vuelve a medir para un arranque limpio.'; exit 1 }

$dir = Split-Path $Exe
$peso = [math]::Round(((Get-ChildItem -LiteralPath $dir -Recurse -File | Measure-Object Length -Sum).Sum) / 1MB, 1)

# 1) Arranque: tiempo hasta que la ventana es visible
$sw = [Diagnostics.Stopwatch]::StartNew()
Start-Process -FilePath $Exe | Out-Null
$arranque = $null
while ($sw.Elapsed.TotalSeconds -lt 30) { if ((Total).ventana) { $arranque = [math]::Round($sw.Elapsed.TotalSeconds, 2); break }; Start-Sleep -Milliseconds 100 }

# 2) Reposo con la ventana abierta: 10 s sin tocar nada
Start-Sleep -Seconds 5
$a = Total; Start-Sleep -Seconds 10; $b = Total
$cpuReposo = [math]::Round((($b.cpuSeg - $a.cpuSeg) / 10 / [Environment]::ProcessorCount) * 100, 2)

$res = [ordered]@{
    version          = (Get-Item -LiteralPath $Exe).VersionInfo.ProductVersion
    equipo           = "$((Get-CimInstance Win32_Processor).Name) · $([math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB)) GB RAM"
    pesoInstaladoMB  = $peso
    arranqueSeg      = $arranque
    procesos         = $b.procesos
    ramAbiertaMB     = $b.ramMB
    ramPrivadaMB     = $b.privMB
    cpuReposoPct     = $cpuReposo
}
Get-Process -Name 'RetroLimpia' | Stop-Process -Force
$res | ConvertTo-Json
