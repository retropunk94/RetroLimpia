# Busca restos (carpetas, accesos directos y registro) que deja un programa al desinstalarse.
# Es conservador: solo marca como "seguro" lo que coincide exactamente con el nombre.
param([string]$P)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $P

function Get-CleanName {
    param([string]$n)
    $n = $n -replace '\(.*?\)', ''
    $n = $n -replace '\b(x64|x86|64-bit|32-bit|64 bits|32 bits|version|versión|v?\d+(\.\d+)+)\b', ''
    $n = $n -replace '\s+-\s+.*$', ''
    $n = $n -replace '\s{2,}', ' '
    return $n.Trim(" -_.,").Trim()
}

$name = Get-CleanName ([string]$p.nombre)
$publisher = ([string]$p.editor) -replace ',?\s*(Inc|LLC|Ltd|GmbH|S\.?A\.?|Corp(oration)?|Co\.)\.?$', ''
$publisher = $publisher.Trim(" ,.")
$isMicrosoft = $publisher -match '^Microsoft'

$names = @($name, ($name -replace ' ', '')) | Where-Object { $_ -and $_.Length -ge 4 } | Select-Object -Unique
$found = New-Object System.Collections.Generic.List[object]
$seen = @{}

function Add-Found {
    param([string]$Tipo, [string]$Ruta, [string]$Confianza)
    $k = $Ruta.ToLowerInvariant()
    if ($seen.ContainsKey($k)) { return }
    if ($Tipo -ne 'registro' -and (Test-ProtectedPath $Ruta)) { return }
    $seen[$k] = $true
    $size = [int64]0
    if ($Tipo -ne 'registro') { $size = Get-PathSize $Ruta }
    $found.Add([pscustomobject]@{ tipo = $Tipo; ruta = $Ruta; tamano = $size; confianza = $Confianza })
}

Send-Progress 10 ('Buscando restos de ' + $name + '...') ('Looking for leftovers of ' + $name + '...')

# 1) La carpeta de instalación original
if ($p.carpeta -and (Test-Path -LiteralPath $p.carpeta)) { Add-Found 'carpeta' ([string]$p.carpeta).TrimEnd('\') 'alta' }

# 2) Carpetas típicas
$bases = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramData, $env:APPDATA, $env:LOCALAPPDATA, "$env:LOCALAPPDATA\Programs", "$env:USERPROFILE\Documents") |
    Where-Object { $_ -and (Test-Path -LiteralPath $_) }

$docs = "$env:USERPROFILE\Documents"
foreach ($b in $bases) {
    # En Documentos puede haber trabajos del usuario: nunca se quita sin preguntar
    $conf = 'alta'
    if ($b -eq $docs) { $conf = 'media' }
    foreach ($n in $names) {
        $c = Join-Path $b $n
        if (Test-Path -LiteralPath $c) { Add-Found 'carpeta' $c $conf }
        if ($publisher -and -not $isMicrosoft -and $publisher.Length -ge 3) {
            $c2 = Join-Path (Join-Path $b $publisher) $n
            if (Test-Path -LiteralPath $c2) { Add-Found 'carpeta' $c2 $conf }
        }
    }
    # Carpeta del editor vacía o que solo contiene restos
    if ($publisher -and -not $isMicrosoft -and $publisher.Length -ge 4) {
        $pubDir = Join-Path $b $publisher
        if (Test-Path -LiteralPath $pubDir) {
            $children = @(Get-ChildItem -LiteralPath $pubDir -Force -ErrorAction SilentlyContinue)
            $others = @($children | Where-Object { $names -notcontains $_.Name })
            if ($others.Count -eq 0) { Add-Found 'carpeta' $pubDir 'media' }
        }
    }
}

Send-Progress 45 'Revisando accesos directos...' 'Checking shortcuts...'

# 3) Accesos directos rotos o con el nombre del programa
$shell = New-Object -ComObject WScript.Shell
$lnkDirs = @("$env:ProgramData\Microsoft\Windows\Start Menu\Programs", "$env:APPDATA\Microsoft\Windows\Start Menu\Programs", "$env:PUBLIC\Desktop", [Environment]::GetFolderPath('Desktop'))
foreach ($d in $lnkDirs) {
    if (-not $d -or -not (Test-Path -LiteralPath $d)) { continue }
    foreach ($n in $names) {
        $sub = Join-Path $d $n
        if (Test-Path -LiteralPath $sub) { Add-Found 'carpeta' $sub 'alta' }
    }
    Get-ChildItem -LiteralPath $d -Filter *.lnk -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $t = $shell.CreateShortcut($_.FullName).TargetPath
            $matchName = $false
            foreach ($n in $names) { if ($_.BaseName -like "*$n*") { $matchName = $true } }
            $brokenTarget = ($t -and -not (Test-Path -LiteralPath $t))
            $inFolder = ($p.carpeta -and $t -and $t.ToLowerInvariant().StartsWith(([string]$p.carpeta).ToLowerInvariant()))
            if ($brokenTarget -and ($matchName -or $inFolder)) { Add-Found 'archivo' $_.FullName 'alta' }
        } catch {}
    }
}

Send-Progress 70 'Revisando el registro...' 'Checking the registry...'

# 4) Registro
$regBases = @('HKCU:\Software', 'HKLM:\SOFTWARE', 'HKLM:\SOFTWARE\WOW6432Node')
foreach ($rb in $regBases) {
    foreach ($n in $names) {
        $k1 = Join-Path $rb $n
        if (Test-Path $k1) { Add-Found 'registro' (Convert-Path $k1) 'alta' }
        if ($publisher -and -not $isMicrosoft -and $publisher.Length -ge 3) {
            $k2 = Join-Path (Join-Path $rb $publisher) $n
            if (Test-Path $k2) { Add-Found 'registro' (Convert-Path $k2) 'alta' }
        }
    }
}
# Entrada de desinstalación huérfana
if ($p.clave -and (Test-Path -LiteralPath ('Registry::' + $p.clave))) { Add-Found 'registro' ([string]$p.clave) 'alta' }

Send-Progress 100 'Listo' 'Done'
Send-Result @{ nombre = $name; restos = @($found) }
