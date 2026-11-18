# Restos de programas antiguos: lo que dejaron programas que ya no están instalados.
# Busca: carpetas vacías, carpetas de programas desinstalados (sin ningún programa dentro),
# accesos directos rotos y entradas "fantasma" en la lista de programas.
# No borra nada: devuelve la lista y la app lo mueve a la cuarentena (se puede deshacer).
# Ojo: PowerShell no distingue mayúsculas ($P y $p serían la misma variable)
param([Alias('P')][string]$EntradaB64)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $EntradaB64

$found = New-Object System.Collections.Generic.List[object]
$seen = @{}
$hace7 = (Get-Date).AddDays(-7)
$hace30 = (Get-Date).AddDays(-30)

function Add-Resto {
    param([string]$Tipo, [string]$Clase, [string]$Ruta, [string]$Nombre, [string]$Confianza, [int64]$Tamano = 0)
    $k = $Ruta.ToLowerInvariant()
    if ($seen.ContainsKey($k)) { return }
    if ($Tipo -ne 'registro' -and (Test-ProtectedPath $Ruta)) { return }
    $seen[$k] = $true
    $found.Add([pscustomobject]@{ tipo = $Tipo; clase = $Clase; ruta = $Ruta; nombre = $Nombre; confianza = $Confianza; tamano = $Tamano })
}

function Norm([string]$s) { if (-not $s) { return '' }; return ($s.ToLowerInvariant() -replace '[^a-z0-9]', '') }

# Nombres de carpetas que son de Windows o de drivers aunque no tengan "desinstalador": nunca se tocan
$NUNCA = '^(microsoft.*|windows.*|internet explorer|common files|package cache|packages|installer|temp|tmp|uninstall information|installshield installation information|reference assemblies|msbuild|dotnet|modifiablewindowsapps|windowsapps|comms|connecteddevicesplatform|d3dscache|crashdumps|peerdistrepub|virtualstore|publishers|usoshared|usoprivate|softwaredistribution|ssh|regid\..*|history|application data|nvidia.*|amd|ati.*|intel.*|realtek|dell|hp|lenovo|asus|acer|msi|logitech|razer|steelseries|corsair|oem|drivers?|downloaded installations|.*\.net.*|programs|google|mozilla.*|retrolimpia|placeholdertilelogofolder|isolatedstorage|steam|epic games|riot games|riot vanguard|easyanticheat.*|battleye)$'

# Lee el contenido de una carpeta paso a paso y para en cuanto sabe la respuesta (rápido incluso en carpetas enormes).
# Devuelve: 'vacia' (ni un archivo), 'sinprograma' (archivos pero ningún .exe/.dll/.sys) o 'conprograma'.
# Si algo no se puede leer, responde 'conprograma' para no tocarlo.
function Get-Contenido([string]$ruta) {
    $pila = New-Object System.Collections.Stack
    $pila.Push($ruta); $hayArchivos = $false; $n = 0
    while ($pila.Count) {
        $d = $pila.Pop()
        try {
            $di = New-Object IO.DirectoryInfo $d
            if ($d -ne $ruta -and ($di.Attributes -band [IO.FileAttributes]::ReparsePoint)) { return 'conprograma' }
            foreach ($f in $di.EnumerateFiles()) {
                $hayArchivos = $true; $n++
                if ($f.Extension -match '^\.(exe|dll|sys|msi|jar|bat|cmd|ps1|py)$') { return 'conprograma' }
                if ($n -gt 4000) { return 'conprograma' }
            }
            foreach ($s in $di.EnumerateDirectories()) { $pila.Push($s.FullName); $n++; if ($n -gt 4000) { return 'conprograma' } }
        } catch { return 'conprograma' }
    }
    if ($hayArchivos) { return 'sinprograma' } else { return 'vacia' }
}

# ---------------------------------------------------------------- 1) Programas instalados
Send-Progress 5 'Leyendo qué programas tienes instalados...' 'Reading your installed programs...'
$uninstKeys = @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall')
$instalados = New-Object System.Collections.Generic.List[string]
$rutasInst = New-Object System.Collections.Generic.List[string]
$entradas = @()
foreach ($uk in $uninstKeys) {
    if (-not (Test-Path $uk)) { continue }
    foreach ($k in (Get-ChildItem $uk -ErrorAction SilentlyContinue)) {
        $v = Get-ItemProperty -LiteralPath $k.PSPath -ErrorAction SilentlyContinue
        if (-not $v) { continue }
        foreach ($x in @($v.DisplayName, $v.Publisher, $k.PSChildName)) { $nx = Norm $x; if ($nx.Length -ge 3) { $instalados.Add($nx) } }
        if ($v.InstallLocation) { $rutasInst.Add(([string]$v.InstallLocation).Trim('" ').TrimEnd('\').ToLowerInvariant()) }
        if ($v.DisplayIcon) { $di = ([string]$v.DisplayIcon).Trim('"') -replace ',\s*-?\d+$', ''; if ($di) { try { $rutasInst.Add((Split-Path -Parent $di).ToLowerInvariant()) } catch {} } }
        $entradas += [pscustomobject]@{ k = $k; v = $v }
    }
}

function Es-Instalado([string]$ruta, [string]$nombre) {
    $r = $ruta.TrimEnd('\').ToLowerInvariant()
    foreach ($ri in $rutasInst) { if ($ri -and ($ri -eq $r -or $ri.StartsWith($r + '\') -or $r.StartsWith($ri + '\'))) { return $true } }
    $n = Norm $nombre
    if ($n.Length -lt 3) { return $true }
    foreach ($i in $instalados) { if ($i.Contains($n) -or ($i.Length -ge 4 -and $n.Contains($i))) { return $true } }
    return $false
}

# ---------------------------------------------------------------- 2) Carpetas
$bases = @(
    @{ r = $env:ProgramFiles; prog = $true }, @{ r = ${env:ProgramFiles(x86)}; prog = $true },
    @{ r = "$env:LOCALAPPDATA\Programs"; prog = $true },
    @{ r = $env:ProgramData; prog = $false }, @{ r = $env:APPDATA; prog = $false }, @{ r = $env:LOCALAPPDATA; prog = $false }
) | Where-Object { $_.r -and (Test-Path -LiteralPath $_.r) }

$i = 0
foreach ($b in $bases) {
    $i++
    Send-Progress (10 + [int](60 * $i / $bases.Count)) 'Buscando carpetas que quedaron de programas viejos...' 'Looking for folders left by old programs...'
    Send-Log 'buscar' 'Revisando' 'Checking' $b.r
    foreach ($d in (Get-ChildItem -LiteralPath $b.r -Directory -Force -ErrorAction SilentlyContinue)) {
        if ($d.Name -match $NUNCA) { continue }
        if ($d.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
        if ($d.LastWriteTime -gt $hace7) { continue }          # recién usada: mejor no tocarla
        $c = Get-Contenido $d.FullName
        # Solo cuenta si no pertenece a ningún programa instalado (si el programa sigue, la carpeta es suya)
        if ($c -eq 'vacia') { if (-not (Es-Instalado $d.FullName $d.Name)) { Add-Resto 'carpeta' 'vacia' $d.FullName $d.Name 'alta' }; continue }
        # Carpeta de un programa que ya no está (solo en carpetas de programas, nunca en tus datos de AppData)
        if ($b.prog -and $c -eq 'sinprograma' -and $d.LastWriteTime -lt $hace30 -and -not (Es-Instalado $d.FullName $d.Name)) {
            Add-Resto 'carpeta' 'huerfana' $d.FullName $d.Name 'media' (Get-PathSize $d.FullName); continue
        }
        # Un nivel más (solo en carpetas de programas): Editor\ProgramaViejo vacío.
        # En AppData NO: los programas crean ahí subcarpetas vacías a propósito (bios, capturas...).
        # Y solo si la carpeta de arriba es un "editor" puro: sin archivos propios y sin programa instalado
        $sinArchivosPropios = $true; try { $sinArchivosPropios = -not ([IO.Directory]::EnumerateFiles($d.FullName) | Select-Object -First 1) } catch { $sinArchivosPropios = $false }
        if ($b.prog -and $sinArchivosPropios -and -not (Es-Instalado $d.FullName $d.Name)) {
            foreach ($s in (Get-ChildItem -LiteralPath $d.FullName -Directory -Force -ErrorAction SilentlyContinue | Select-Object -First 60)) {
                if ($s.Name -match $NUNCA -or $s.LastWriteTime -gt $hace7) { continue }
                if ($s.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
                if ((Get-Contenido $s.FullName) -eq 'vacia' -and -not (Es-Instalado $s.FullName $s.Name)) { Add-Resto 'carpeta' 'vacia' $s.FullName ($d.Name + ' › ' + $s.Name) 'alta' }
            }
        }
    }
}

# ---------------------------------------------------------------- 3) Accesos directos rotos
Send-Progress 75 'Buscando accesos directos que ya no abren nada...' 'Looking for shortcuts that open nothing...'
$shell = New-Object -ComObject WScript.Shell
$menus = @("$env:ProgramData\Microsoft\Windows\Start Menu\Programs", "$env:APPDATA\Microsoft\Windows\Start Menu\Programs") | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$escritorios = @("$env:PUBLIC\Desktop", [Environment]::GetFolderPath('Desktop')) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
# En el menú Inicio se mira todo; en el Escritorio solo los accesos sueltos (nunca dentro de tus carpetas)
$lnks = @(foreach ($m in $menus) { Get-ChildItem -LiteralPath $m -Filter *.lnk -Recurse -Force -ErrorAction SilentlyContinue }) +
        @(foreach ($e in $escritorios) { Get-ChildItem -LiteralPath $e -Filter *.lnk -Force -ErrorAction SilentlyContinue })
foreach ($f in $lnks) {
    try {
        $t = [string]$shell.CreateShortcut($f.FullName).TargetPath
        if (-not $t -or $t -notmatch '^[A-Za-z]:\\' -or $t -match '%') { continue }   # solo rutas locales normales
        if (-not (Test-Path -LiteralPath $t.Substring(0, 3))) { continue }           # disco desconectado: no es que esté roto
        if (Test-Path -LiteralPath $t) { continue }
        # Accesos guardados con %ProgramFiles% pueden apuntar en realidad a "Program Files (x86)"
        $alt = if ($t -match '\\Program Files\\') { $t -replace '\\Program Files\\', '\Program Files (x86)\' } elseif ($t -match '\\Program Files \(x86\)\\') { $t -replace '\\Program Files \(x86\)\\', '\Program Files\' } else { $null }
        if ($alt -and (Test-Path -LiteralPath $alt)) { continue }
        Add-Resto 'archivo' 'acceso' $f.FullName $f.BaseName 'alta'
    } catch {}
}
# Carpetas vacías del menú Inicio (solo ahí)
foreach ($ld in $menus) {
    foreach ($sd in (Get-ChildItem -LiteralPath $ld -Directory -Recurse -Force -ErrorAction SilentlyContinue)) {
        if ($sd.FullName -match '\\Startup(\\|$)' -or $sd.LastWriteTime -gt $hace7) { continue }   # la carpeta Inicio de Windows nunca
        if ((Get-Contenido $sd.FullName) -eq 'vacia') { Add-Resto 'carpeta' 'vacia' $sd.FullName $sd.Name 'alta' }
    }
}

# ---------------------------------------------------------------- 4) Entradas fantasma en "Programas"
Send-Progress 90 'Buscando programas fantasma en la lista de Windows...' 'Looking for ghost entries in the Windows list...'
foreach ($e in $entradas) {
    $v = $e.v
    if (-not $v.DisplayName -or $v.SystemComponent -eq 1 -or $v.WindowsInstaller -eq 1) { continue }
    if ($v.BundleProviderKey -or $v.BundleVersion -or $v.BundleCachePath) { continue }        # paquetes como Visual C++: su instalador vive en una caché
    if ($e.k.PSPath -match 'WOW6432Node' -and ([string]$v.UninstallString) -match [regex]::Escape($env:windir)) { continue }   # 32 bits en System32: Windows engaña la ruta
    $us = [string]$v.UninstallString
    if (-not $us -or $us -match 'msiexec') { continue }
    $exe = if ($us -match '^\s*"([^"]+)"') { $Matches[1] } elseif ($us -match '^\s*([A-Za-z]:\\[^"]*?\.exe)') { $Matches[1] } else { '' }
    if (-not $exe -or $exe -match '%' -or $exe.ToLowerInvariant().StartsWith($env:windir.ToLowerInvariant())) { continue }
    if (-not (Test-Path -LiteralPath $exe.Substring(0, 3))) { continue }
    $loc = ([string]$v.InstallLocation).Trim('" ')
    if ((Test-Path -LiteralPath $exe) -or ($loc -and (Test-Path -LiteralPath $loc))) { continue }
    Add-Resto 'registro' 'fantasma' ($e.k.Name) ([string]$v.DisplayName) 'alta'
}

# Si una carpeta ya está en la lista, lo de dentro no se repite
$carpetas = @($found | Where-Object { $_.tipo -eq 'carpeta' } | ForEach-Object { $_.ruta.ToLowerInvariant() + '\' })
$found = @($found | Where-Object { $r = $_.ruta.ToLowerInvariant(); -not ($carpetas | Where-Object { $r.StartsWith($_) }) })
$tot = ($found | Measure-Object -Property tamano -Sum).Sum
Send-Log 'ok' ('Encontrados ' + @($found).Count + ' restos') ('Found ' + @($found).Count + ' leftovers')
Send-Progress 100 'Listo' 'Done'
Send-Result @{ restos = @($found); total = [int64]$tot }
