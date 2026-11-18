# Limpieza de archivos basura. Solo toca cachés y temporales: nunca tus documentos,
# fotos, contraseñas ni historial del navegador.
# Acciones: analizar, limpiar
# Ojo: PowerShell no distingue mayúsculas ($P y $p serían la misma variable)
param([Alias('P')][string]$EntradaB64)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $EntradaB64

function Get-BrowserCacheDirs {
    $dirs = @()
    foreach ($b in @("$env:LOCALAPPDATA\Google\Chrome\User Data", "$env:LOCALAPPDATA\Microsoft\Edge\User Data", "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data")) {
        if (Test-Path -LiteralPath $b) {
            Get-ChildItem -LiteralPath $b -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile *' } | ForEach-Object {
                foreach ($c in @('Cache\Cache_Data', 'Code Cache', 'GPUCache')) { $d = Join-Path $_.FullName $c; if (Test-Path -LiteralPath $d) { $dirs += $d } }
            }
        }
    }
    $ff = "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles"
    if (Test-Path -LiteralPath $ff) {
        Get-ChildItem -LiteralPath $ff -Directory -ErrorAction SilentlyContinue | ForEach-Object { $d = Join-Path $_.FullName 'cache2'; if (Test-Path -LiteralPath $d) { $dirs += $d } }
    }
    return $dirs
}

# Cachés web de launchers y Discord (solo la caché: nunca juegos, partidas ni sesiones)
function Get-LauncherCacheDirs {
    # Solo carpetas que son caché pura. Nada de perfiles de navegador (ahí van las sesiones iniciadas).
    $l = @(
        "$env:LOCALAPPDATA\Steam\htmlcache\Cache", "$env:LOCALAPPDATA\Steam\htmlcache\Code Cache", "$env:LOCALAPPDATA\Steam\htmlcache\GPUCache",
        "$env:LOCALAPPDATA\Battle.net\Cache",
        "$env:APPDATA\discord\Cache", "$env:APPDATA\discord\Code Cache", "$env:APPDATA\discord\GPUCache"
    )
    $steam = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue).SteamPath
    if ($steam) { $l += (Join-Path ($steam -replace '/', '\') 'appcache\httpcache') }
    return @($l | Where-Object { Test-Path -LiteralPath $_ })
}

$categories = [ordered]@{
    temp_usuario  = @{ rutas = @($env:TEMP); color = 'verde' }
    temp_windows  = @{ rutas = @("$env:windir\Temp"); color = 'verde' }
    wu_cache      = @{ rutas = @("$env:windir\SoftwareDistribution\Download"); color = 'verde' }
    entrega       = @{ rutas = @("$env:windir\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache"); color = 'verde' }
    informes      = @{ rutas = @("$env:ProgramData\Microsoft\Windows\WER\ReportArchive", "$env:ProgramData\Microsoft\Windows\WER\ReportQueue", "$env:LOCALAPPDATA\CrashDumps"); color = 'verde' }
    miniaturas    = @{ rutas = @("$env:LOCALAPPDATA\Microsoft\Windows\Explorer"); filtro = 'thumbcache_*.db'; color = 'verde' }
    navegadores   = @{ rutas = @(Get-BrowserCacheDirs); color = 'amarillo' }
    volcados      = @{ rutas = @("$env:windir\Minidump", "$env:windir\MEMORY.DMP"); color = 'amarillo' }
    papelera      = @{ rutas = @(); color = 'amarillo' }
    # Limpieza gamer: se vuelven a crear solas. Los shaders hacen que la primera partida tras limpiar
    # tarde un poco más en cargar (por eso es amarillo): útil si un juego va a tirones o tras cambiar de driver.
    shaders       = @{ rutas = @("$env:LOCALAPPDATA\D3DSCache", "$env:LOCALAPPDATA\NVIDIA\DXCache", "$env:LOCALAPPDATA\NVIDIA\GLCache", "$env:ProgramData\NVIDIA Corporation\NV_Cache", "$env:LOCALAPPDATA\AMD\DxCache", "$env:LOCALAPPDATA\AMD\DxcCache", "$env:LOCALAPPDATA\AMD\GLCache", "$env:LOCALAPPDATA\AMD\VkCache", "$env:LOCALAPPDATA\Intel\ShaderCache"); color = 'amarillo' }
    launchers     = @{ rutas = @(Get-LauncherCacheDirs); color = 'verde' }
}

function Get-RecycleSize {
    try {
        $sh = New-Object -ComObject Shell.Application
        $sum = [int64]0
        foreach ($i in $sh.NameSpace(10).Items()) { $sum += [int64]$i.Size }
        return $sum
    } catch { return [int64]0 }
}

function Get-CategorySize {
    param($cat, [string]$key)
    if ($key -eq 'papelera') { return Get-RecycleSize }
    $sum = [int64]0
    foreach ($r in $cat.rutas) {
        if (-not $r -or -not (Test-Path -LiteralPath $r)) { continue }
        if ($cat.filtro) {
            $sum += [int64](Get-ChildItem -LiteralPath $r -Filter $cat.filtro -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        } else { $sum += Get-PathSize $r }
    }
    return $sum
}

function Clear-Folder {
    param([string]$Path, [string]$Filter)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if ($item -and -not $item.PSIsContainer) { Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue; return }
    if ($Filter) {
        Get-ChildItem -LiteralPath $Path -Filter $Filter -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
        return
    }
    # Borra el contenido, no la carpeta. Lo que esté en uso se salta.
    Get-ChildItem -LiteralPath $Path -Force -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
}

switch ($p.accion) {
    'analizar' {
        $out = New-Object System.Collections.Generic.List[object]
        $i = 0
        foreach ($k in $categories.Keys) {
            $i++
            Send-Progress ([int](100 * $i / $categories.Count)) 'Midiendo archivos basura...' 'Measuring junk files...'
            $out.Add(@{ id = $k; tamano = (Get-CategorySize $categories[$k] $k); color = $categories[$k].color })
        }
        Send-Result @{ categorias = $out.ToArray() }
    }
    'limpiar' {
        $sel = @($p.categorias)
        $before = [int64]0
        foreach ($k in $sel) { if ($categories.Contains($k)) { $before += Get-CategorySize $categories[$k] $k } }
        $i = 0
        foreach ($k in $sel) {
            if (-not $categories.Contains($k)) { continue }
            $i++
            Send-Progress ([int](100 * $i / [Math]::Max(1, $sel.Count))) ('Limpiando: ' + $k) ('Cleaning: ' + $k)
            switch ($k) {
                'papelera' { try { Clear-RecycleBin -Force -ErrorAction SilentlyContinue } catch {} }
                'wu_cache' {
                    Stop-Service -Name wuauserv, bits -Force -ErrorAction SilentlyContinue
                    Clear-Folder "$env:windir\SoftwareDistribution\Download"
                    Start-Service -Name bits, wuauserv -ErrorAction SilentlyContinue
                }
                'entrega' {
                    if (Get-Command Delete-DeliveryOptimizationCache -ErrorAction SilentlyContinue) { Delete-DeliveryOptimizationCache -Force -ErrorAction SilentlyContinue }
                    else { foreach ($r in $categories[$k].rutas) { Clear-Folder $r } }
                }
                default { foreach ($r in $categories[$k].rutas) { Clear-Folder $r $categories[$k].filtro } }
            }
        }
        $after = [int64]0
        foreach ($k in $sel) { if ($categories.Contains($k)) { $after += Get-CategorySize $categories[$k] $k } }
        $freed = [Math]::Max([int64]0, $before - $after)
        Write-RLLog ('Limpieza: liberados ' + [math]::Round($freed / 1MB) + ' MB')
        Send-Progress 100 'Listo' 'Done'
        Send-Result @{ liberado = $freed }
    }
    default { Send-Result @{ ok = $false } }
}
