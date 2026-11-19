# Desinstala un programa intentando primero el modo silencioso (sin ventanas).
# Si el programa no lo permite, abre su desinstalador normal como último recurso.
# Ojo: PowerShell no distingue mayúsculas ($P y $p serían la misma variable)
param([Alias('P')][string]$EntradaB64)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $EntradaB64

function Test-Gone {
    param([string]$KeyName)
    if (-not $KeyName) { return $false }
    return -not (Test-Path -LiteralPath ('Registry::' + $KeyName))
}

function Split-Command {
    param([string]$Cmd)
    $Cmd = [Environment]::ExpandEnvironmentVariables($Cmd.Trim())
    $Cmd = $Cmd -replace '\\"', '"'   # algunos programas guardan \"ruta\" (Far Cry 3): se limpia
    if ($Cmd.StartsWith('"')) {
        $end = $Cmd.IndexOf('"', 1)
        if ($end -gt 1) { return @{ exe = $Cmd.Substring(1, $end - 1); args = $Cmd.Substring($end + 1).Trim() } }
    }
    $m = [regex]::Match($Cmd, '^(.+?\.exe)(\s+.*)?$', 'IgnoreCase')
    if ($m.Success) { return @{ exe = $m.Groups[1].Value; args = $m.Groups[2].Value.Trim() } }
    return @{ exe = $Cmd; args = '' }
}

# Si el desinstalador del registro ya no existe (p. ej. el programa se actualizó a otra carpeta de versión),
# busca el mismo archivo en la carpeta de versión más nueva. OneDrive tiene su propio caso conocido.
function Resolve-Uninstaller {
    param([string]$Cmd)
    $c = Split-Command $Cmd
    $res = @{ exe = $c.exe; args = $c.args; silencioso = $false; existe = $false; cambiado = $false }
    $leaf = [IO.Path]::GetFileName($c.exe)
    if ($leaf -ieq 'OneDriveSetup.exe') {
        # OneDrive se desinstala en silencio con /uninstall (sin ventanas)
        $res.silencioso = $true
        if ($res.args -notmatch '/uninstall') { $res.args = ('/uninstall ' + $res.args).Trim() }
        if (-not (Test-Path -LiteralPath $c.exe)) {
            $cands = @()
            foreach ($b in @("$env:LOCALAPPDATA\Microsoft\OneDrive", "$env:ProgramFiles\Microsoft OneDrive", "${env:ProgramFiles(x86)}\Microsoft OneDrive")) {
                if ($b -and (Test-Path -LiteralPath $b)) { $cands += @(Get-ChildItem -LiteralPath $b -Filter OneDriveSetup.exe -Recurse -Depth 1 -ErrorAction SilentlyContinue) }
            }
            foreach ($f in @("$env:windir\System32\OneDriveSetup.exe", "$env:windir\SysWOW64\OneDriveSetup.exe")) { if (Test-Path -LiteralPath $f) { $cands += Get-Item -LiteralPath $f } }
            $mejor = $cands | Sort-Object { $_.VersionInfo.FileVersionRaw } -Descending | Select-Object -First 1
            if ($mejor) { $res.exe = $mejor.FullName; $res.cambiado = $true }
        }
    } elseif ($c.exe -and -not (Test-Path -LiteralPath $c.exe)) {
        # ...\Programa\1.2.3\uninstall.exe -> busca ...\Programa\<otra versión>\uninstall.exe
        try {
            # SOLO si la carpeta es un número de versión (1.2.3): así nunca se confunde con el desinstalador de OTRO programa
            # (p. ej. "InstallShield Installation Information\{GUID}" guarda los de muchos programas distintos)
            $verDir = Split-Path (Split-Path $c.exe -Parent) -Leaf
            $padre = Split-Path (Split-Path $c.exe -Parent) -Parent
            if ($verDir -match '^v?\d+(\.\d+)+$' -and $padre -and (Test-Path -LiteralPath $padre) -and -not (Test-ProtectedPath $padre)) {
                $otro = Get-ChildItem -LiteralPath $padre -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^v?\d+(\.\d+)+$' } | ForEach-Object { Join-Path $_.FullName $leaf } |
                    Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { Get-Item -LiteralPath $_ } |
                    Sort-Object LastWriteTime -Descending | Select-Object -First 1
                if ($otro) { $res.exe = $otro.FullName; $res.cambiado = $true }
            }
        } catch {}
    }
    $res.existe = [bool]($res.exe -and ($res.exe -notmatch '\\' -or (Test-Path -LiteralPath $res.exe)))
    return $res
}

# Mensajes de Windows traducidos a algo que se entienda
function Get-MensajeClaro([string]$m) {
    if ($m -match 'no puede encontrar el archivo|cannot find the file|could not find') { return 'El desinstalador de este programa ya no está en el PC (suele pasar si el programa se actualizó o se borró a medias).' }
    if ($m -match 'acceso denegado|access is denied') { return 'Windows no dio permiso. Abre RetroLimpia como administrador y vuelve a intentarlo.' }
    if ($m -match 'cancel') { return 'Se canceló en la ventana del programa.' }
    return $m
}

function Start-Cmd {
    param([string]$Exe, [string]$ArgStr, [switch]$Hidden)
    $sp = @{ FilePath = $Exe; PassThru = $true }
    if ($ArgStr) { $sp.ArgumentList = $ArgStr }
    if ($Hidden) { $sp.WindowStyle = 'Hidden' }
    return Start-Process @sp
}

function Get-InstallerKind {
    param([string]$Exe)
    $leaf = [IO.Path]::GetFileName($Exe).ToLowerInvariant()
    if ($leaf -match '^unins\d+\.exe$') { return 'inno' }
    if (-not (Test-Path -LiteralPath $Exe)) { return 'desconocido' }
    try {
        $fs = [IO.File]::OpenRead($Exe)
        $len = [Math]::Min($fs.Length, 2MB)
        $buf = New-Object byte[] $len
        [void]$fs.Read($buf, 0, $len)
        $fs.Close()
        $txt = [Text.Encoding]::ASCII.GetString($buf)
        if ($txt -match 'Nullsoft') { return 'nsis' }
        if ($txt -match 'Inno Setup') { return 'inno' }
        if ($txt -match 'InstallShield') { return 'installshield' }
    } catch {}
    return 'desconocido'
}

function Wait-Uninstall {
    param($Proc, [string]$KeyName, [int]$TimeoutSec = 900)
    $sw = [Diagnostics.Stopwatch]::StartNew()
    if ($Proc) { try { $null = $Proc.WaitForExit($TimeoutSec * 1000) } catch {} }
    # NSIS y otros se copian a TEMP (Au_.exe) y el proceso original termina enseguida
    while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
        $helpers = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match '^(Au_|Un_A|Un_|_iu14D2N|unins\d+)$' }
        if (-not $helpers) { break }
        Start-Sleep -Milliseconds 800
    }
    # Pequeña espera para que el registro se actualice
    for ($i = 0; $i -lt 10; $i++) { if (Test-Gone $KeyName) { break }; Start-Sleep -Milliseconds 500 }
}

function Stop-AppProcesses {
    param([string]$Folder)
    if (-not $Folder -or -not (Test-Path -LiteralPath $Folder) -or (Test-ProtectedPath $Folder)) { return }
    $f = $Folder.TrimEnd('\').ToLowerInvariant() + '\'
    Get-Process -ErrorAction SilentlyContinue | Where-Object {
        try { $_.Path -and $_.Path.ToLowerInvariant().StartsWith($f) } catch { $false }
    } | ForEach-Object {
        Send-Log 'paso' ('Cerrando ' + $_.ProcessName + ' (estaba abierto)') ('Closing ' + $_.ProcessName + ' (it was open)') ([string]$_.Path)
        try { $_ | Stop-Process -Force -ErrorAction SilentlyContinue } catch {}
    }
}

if ($p.accion -eq 'resolver') { Send-Result (Resolve-Uninstaller ([string]$p.desinstalar)); return }

$label = [string]$p.nombre
if ($p.etiqueta) { $label = [string]$p.etiqueta }
$result = @{ ok = $false; metodo = ''; reinicio = $false; mensaje = ''; nombre = $p.nombre }

# ---------------- Apps de Microsoft Store ----------------
if ($p.tipo -eq 'appx') {
    Send-Progress 20 ('Quitando ' + $label + '...') ('Removing ' + $label + '...')
    Send-Log 'paso' 'Quitando la app de Microsoft Store' 'Removing the Microsoft Store app' ([string]$p.paquete)
    if ($p.carpeta) { Send-Log 'info' 'Carpeta de la app' 'App folder' ([string]$p.carpeta) }
    try {
        try { Remove-AppxPackage -Package $p.paquete -AllUsers -ErrorAction Stop }
        catch { Remove-AppxPackage -Package $p.paquete -ErrorAction Stop }
        # Evita que Windows la vuelva a instalar en usuarios nuevos
        try {
            Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue |
                Where-Object { $_.DisplayName -eq $p.nombre } |
                ForEach-Object {
                    Send-Log 'paso' 'Quitando la copia que Windows reinstala a usuarios nuevos' 'Removing the copy Windows reinstalls for new users' $_.PackageName
                    Remove-AppxProvisionedPackage -Online -PackageName $_.PackageName -ErrorAction SilentlyContinue | Out-Null
                }
        } catch {}
        $result.ok = $true; $result.metodo = 'appx'; $result.registroLimpio = $true
        Send-Log 'ok' 'App quitada correctamente' 'App removed successfully'
    } catch {
        $result.mensaje = $_.Exception.Message
        Send-Log 'error' ('No se pudo quitar: ' + $_.Exception.Message) ('Could not remove: ' + $_.Exception.Message)
    }
    Write-RLLog ('Desinstalar appx ' + $p.nombre + ' -> ' + $result.ok)
    Send-Progress 100 'Listo' 'Done'
    Send-Result $result
    return
}

# ---------------- Programas clásicos ----------------
$key = [string]$p.clave
Send-Log 'info' ('Programa: ' + $label + $(if ($p.version) { ' ' + $p.version } else { '' })) ('Program: ' + $label)
if ($p.carpeta) { Send-Log 'info' 'Carpeta de instalación' 'Install folder' ([string]$p.carpeta) }
if ($key) { Send-Log 'info' 'Su entrada en el registro de Windows' 'Its Windows registry entry' $key }
# OneDrive se cierra solo al desinstalarse; cerrarlo a la fuerza puede cortar su actualizador a medias
if ($p.cerrarProcesos -ne $false -and ([string]$p.desinstalar) -notmatch 'OneDriveSetup\.exe') { Stop-AppProcesses $p.carpeta }

$cmd = [string]$p.desinstalar
$quiet = [string]$p.desinstalarSilencioso
# SEGURIDAD: el comando no se toma a ciegas de la interfaz: se vuelve a leer de la ficha del programa
# en el registro de Windows. Así solo se ejecuta el desinstalador que el propio programa registró.
if ($key -and $key -notmatch '\\Windows\\CurrentVersion\\Uninstall\\[^\\]+$') {
    $result.mensaje = 'Petición no válida: no es la ficha de un programa instalado.'
    Send-Log 'error' $result.mensaje 'Invalid request: not an installed program entry'
    Send-Result $result; return
}
if ($key) {
    $ficha = Get-ItemProperty -LiteralPath ('Registry::' + $key) -ErrorAction SilentlyContinue
    if ($ficha) { $cmd = [string]$ficha.UninstallString; $quiet = [string]$ficha.QuietUninstallString }
}

# ---------------- Juegos de plataformas (Steam, Epic, EA, Ubisoft...) ----------------
# Estas tiendas desinstalan con su propia ventana y el comando termina al instante:
# hay que esperar a que la plataforma acabe de verdad antes de revisar nada.
function Get-Platform {
    param([string]$Key, [string]$Cmd)
    if ($Key -match 'Steam App (\d+)$' -or $Cmd -match 'steam://uninstall/(\d+)') { return @{ nombre = 'Steam'; id = $Matches[1] } }
    if ($Cmd -match 'com\.epicgames\.launcher://') { return @{ nombre = 'Epic Games' } }
    if ($Cmd -match 'uplay://|ubisoft') { return @{ nombre = 'Ubisoft Connect' } }
    if ($Cmd -match 'EADesktop|\\Origin\\|origin2://|ealink://') { return @{ nombre = 'EA app' } }
    if ($Cmd -match 'Battle\.net') { return @{ nombre = 'Battle.net' } }
    if ($Cmd -match 'GalaxyClient|goggalaxy://') { return @{ nombre = 'GOG Galaxy' } }
    if ($Cmd -match '^\s*"?[^"]*\.exe"?\s+[a-z0-9\.\-]+://' ) { return @{ nombre = 'su tienda' } }
    return $null
}

function Get-Firma {
    # "Huella" de lo que hay en disco: si cambia, la plataforma está trabajando
    param([string]$Folder, [string]$Manifest)
    $f = ''
    if ($Folder -and (Test-Path -LiteralPath $Folder)) {
        try { $f += 'D' + @(Get-ChildItem -LiteralPath $Folder -Force -ErrorAction SilentlyContinue).Count } catch {}
    } else { $f += 'sinCarpeta' }
    if ($Manifest -and (Test-Path -LiteralPath $Manifest)) { $f += 'M' + (Get-Item -LiteralPath $Manifest).LastWriteTimeUtc.Ticks } else { $f += 'sinManifest' }
    return $f
}

$plat = Get-Platform $key $cmd
if ($plat) {
    $result.plataforma = $plat.nombre
    $loc0 = ([string]$p.carpeta).Trim('"')
    $manifest = $null
    if ($plat.nombre -eq 'Steam' -and $plat.id -and $loc0) {
        $sa = Split-Path (Split-Path $loc0 -Parent) -Parent   # ...\steamapps
        $manifest = Join-Path $sa ('appmanifest_' + $plat.id + '.acf')
        Send-Log 'info' 'Ficha del juego en Steam' 'Game manifest in Steam' $manifest
    }
    Send-Log 'paso' ('Este juego es de ' + $plat.nombre + ': se lo pedimos a ' + $plat.nombre + '. Confirma en su ventana (botón Desinstalar).') ('This game belongs to ' + $plat.nombre + ': we ask ' + $plat.nombre + ' to remove it. Confirm in its window.') $cmd
    Send-Progress 30 ('Confirma en la ventana de ' + $plat.nombre + '...') ('Confirm in the ' + $plat.nombre + ' window...')
    try {
        $c = Split-Command $cmd
        $null = Start-Cmd $c.exe $c.args
    } catch { $result.mensaje = $_.Exception.Message }

    # Espera hasta que la tienda termine. Se da por desinstalado si pasa cualquiera de estas cosas:
    #  - desaparece su entrada del registro, o
    #  - desaparece la ficha del juego (Steam: appmanifest), o
    #  - desaparece su carpeta.
    # (Steam a veces deja la entrada del registro: entonces se trata como resto y se limpia.)
    # Si en 3 minutos no cambia nada, se da por cancelado. Tope total: 20 minutos.
    $habiaManifest = [bool]($manifest -and (Test-Path -LiteralPath $manifest))
    $habiaCarpeta = [bool]($loc0 -and (Test-Path -LiteralPath $loc0))
    function Test-Terminado {
        if (Test-Gone $key) { return $true }
        if ($habiaManifest -and -not (Test-Path -LiteralPath $manifest)) { return $true }
        if ($habiaCarpeta -and -not (Test-Path -LiteralPath $loc0)) { return $true }
        return $false
    }
    $sw = [Diagnostics.Stopwatch]::StartNew(); $quieto = [Diagnostics.Stopwatch]::StartNew()
    $firma = Get-Firma $loc0 $manifest; $avisado = $false; $terminado = $false
    while ($sw.Elapsed.TotalMinutes -lt 20) {
        if (Test-Terminado) { $terminado = $true; break }
        Start-Sleep -Seconds 2
        $f2 = Get-Firma $loc0 $manifest
        if ($f2 -ne $firma) {
            $firma = $f2; $quieto.Restart()
            if (-not $avisado) { $avisado = $true; Send-Log 'paso' ($plat.nombre + ' está borrando el juego...') ($plat.nombre + ' is deleting the game...') $loc0 }
        }
        $seg = [int]$sw.Elapsed.TotalSeconds
        $resta = [int](180 - $quieto.Elapsed.TotalSeconds)
        if ($avisado) { Send-Progress ([Math]::Min(85, 40 + [int]($sw.Elapsed.TotalSeconds / 4))) ($plat.nombre + ' está borrando el juego... (' + $seg + ' s)') ($plat.nombre + ' is deleting the game... (' + $seg + ' s)') }
        else { Send-Progress 20 ('Esperando que confirmes en la ventana de ' + $plat.nombre + '... (si no haces nada, se cancela en ' + $resta + ' s)') ('Waiting for you to confirm in ' + $plat.nombre + '... (auto-cancel in ' + $resta + ' s)') }
        if ($quieto.Elapsed.TotalMinutes -ge 3) { break }
    }
    if ($terminado) {
        Send-Progress 90 'Comprobando que no quede nada...' 'Checking nothing is left...'
        # La tienda termina de borrar unos segundos después: margen de hasta 1 minuto
        for ($i = 0; $i -lt 30 -and $loc0 -and (Test-Path -LiteralPath $loc0); $i++) { Start-Sleep -Seconds 2 }
        for ($i = 0; $i -lt 5 -and -not (Test-Gone $key); $i++) { Start-Sleep -Seconds 2 }
    }
    $result.metodo = 'plataforma'
    $result.ok = $terminado
    $result.registroLimpio = Test-Gone $key
    if ($terminado -and -not $result.registroLimpio) { Send-Log 'aviso' ($plat.nombre + ' dejó su entrada en el registro: se limpia como resto (con copia en la cuarentena)') ($plat.nombre + ' left its registry entry: cleaned as leftover') $key }
    $result.carpetaQueda = [bool]($loc0 -and (Test-Path -LiteralPath $loc0))
    if ($result.ok) {
        Send-Log 'ok' ($plat.nombre + ' desinstaló el juego') ($plat.nombre + ' uninstalled the game') $key
        if ($result.carpetaQueda) { Send-Log 'aviso' ($plat.nombre + ' dejó la carpeta del juego (partidas, mods o ajustes): se revisará como resto') ($plat.nombre + ' left the game folder: checked as leftover') $loc0 }
    } else {
        $result.cancelado = $true
        $result.mensaje = $plat.nombre + ' no lo desinstaló (¿cancelaste en su ventana?). No se tocó nada.'
        Send-Log 'aviso' ($plat.nombre + ' no lo desinstaló: si cancelaste en su ventana, no pasa nada. No se tocó nada del juego.') ($plat.nombre + ' did not uninstall it. Nothing of the game was touched.')
    }
    Write-RLLog ('Desinstalar (plataforma ' + $plat.nombre + ') ' + $p.nombre + ' ok=' + $result.ok)
    Send-Progress 100 'Listo' 'Done'
    Send-Result $result
    return
}

Send-Progress 15 ('Desinstalando ' + $label + ' en silencio...') ('Silently uninstalling ' + $label + '...')

# Cierra restos de un intento anterior (un desinstalador que se quedó esperando)
function Stop-Desinstaladores {
    Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match '^(_iu14D2N|unins\d+|Au_|Un_A)$' } |
        ForEach-Object { try { $_ | Stop-Process -Force -ErrorAction SilentlyContinue } catch {} }
}
$keyLeaf = if ($key) { Split-Path $key -Leaf } else { '' }
$esInno = ($keyLeaf -match '_is1$') -or ($cmd -match 'unins\d+\.exe')
$guidKey = if ($keyLeaf -match '^\{[0-9A-Fa-f\-]{36}\}$') { $keyLeaf } else { $null }

try {
    # 1) Windows Installer (MSI): el más fiable. También para programas tipo InstallShield cuya ficha es un {GUID}
    $guid = $null
    if ($cmd -match 'msiexec' -and $cmd -match '(\{[0-9A-Fa-f\-]{36}\})') { $guid = $Matches[1] }
    elseif ($guidKey -and -not $esInno) { $guid = $guidKey }
    if ($guid) {
        Send-Log 'paso' 'Ejecutando su desinstalador (Windows Installer) en silencio' 'Running its uninstaller (Windows Installer) silently' "msiexec.exe /x $guid /qn"
        $proc = Start-Process -FilePath "$env:windir\System32\msiexec.exe" -ArgumentList "/x $guid /qn /norestart" -PassThru -WindowStyle Hidden
        $proc.WaitForExit()
        $code = $proc.ExitCode
        if ($code -eq 3010 -or $code -eq 1641) { $result.reinicio = $true }
        if ($code -in 0, 3010, 1641) { $result.ok = $true; $result.metodo = 'msi' }
        elseif ($code -in 1605, 1614 -and $cmd -match 'msiexec') { $result.ok = $true; $result.metodo = 'msi' }   # ya no estaba
        else { Send-Log 'info' ('Windows Installer no pudo (código ' + $code + '): pruebo con su desinstalador') ('Windows Installer could not (code ' + $code + ')') }
    }

    if (-not $result.ok -and -not ($cmd -match 'msiexec')) {
        $c = Resolve-Uninstaller $(if ($quiet) { $quiet } else { $cmd })
        if ($c.cambiado) { Send-Log 'info' 'Su desinstalador cambió de sitio (el programa se actualizó): uso el actual' 'Its uninstaller moved (program was updated): using the current one' $c.exe }
        if (-not $c.existe -and $quiet -and $cmd) { $c = Resolve-Uninstaller $cmd }
        if (-not $c.existe) {
            Send-Log 'aviso' 'Su desinstalador ya no está en el PC' 'Its uninstaller is no longer on this PC' $c.exe
            $loc1 = ([string]$p.carpeta).Trim('"')
            $quedaPrograma = $loc1 -and (Test-Path -LiteralPath $loc1) -and @(Get-ChildItem -LiteralPath $loc1 -Filter *.exe -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object -First 1).Count
            if (-not $quedaPrograma) {
                Send-Log 'ok' 'El programa ya no estaba instalado: solo quedaba su nombre en la lista de Windows. Se limpia como resto.' 'The program was already gone: only its entry remained. Cleaned as leftover.'
                $result.ok = $true; $result.metodo = 'ya-no-estaba'
            } else {
                $result.puedeForzar = $true
                $result.mensaje = 'Su desinstalador ya no existe (pasa con copias "repack" o programas borrados a medias), pero sus archivos siguen ahí. Puedes quitarlo a la fuerza: su carpeta y su entrada van a la cuarentena y se pueden restaurar.'
            }
            $cmd = $null   # no tiene sentido abrir un asistente que no existe
        } else {
            $kind = if ($esInno -or [IO.Path]::GetFileName($c.exe) -match '^unins\d+\.exe$') { 'inno' } elseif ($c.silencioso) { 'oficial' } elseif ($quiet) { 'oficial' } else { Get-InstallerKind $c.exe }
            $args2 = $c.args
            switch ($kind) {
                'inno'          { $args2 = (($c.args -replace '(?i)/(VERY)?SILENT|/SUPPRESSMSGBOXES|/NORESTART', '') + ' /VERYSILENT /SUPPRESSMSGBOXES /NORESTART').Trim() }
                'nsis'          { $args2 = ($c.args + ' /S').Trim() }
                'installshield' { $args2 = ($c.args + ' -s').Trim() }
                'oficial'       { }
                default         { $kind = $null }
            }
            if ($kind) {
                Send-Log 'paso' ('Ejecutando su desinstalador en silencio (tipo ' + $kind + ')') ('Running its uninstaller silently (' + $kind + ')') ($c.exe + ' ' + $args2)
                # Inno: sin ocultar la ventana. Si el programa hace una pregunta propia, tiene que verse (si no, se queda esperando para siempre)
                if ($kind -eq 'inno') { $proc = Start-Cmd $c.exe $args2 } else { $proc = Start-Cmd $c.exe $args2 -Hidden }
                Wait-Uninstall $proc $key 600
                $result.metodo = 'silencioso-' + $kind
                $result.ok = Test-Gone $key
            }
        }
    }
} catch {
    $result.mensaje = Get-MensajeClaro $_.Exception.Message
}

# Último recurso: el desinstalador normal del programa (una ventana, inevitable)
if (-not $result.ok -and $cmd -and $p.permitirVentana -ne $false) {
    Stop-Desinstaladores   # que no choque con un intento silencioso que se quedó colgado
    Send-Progress 50 ('Este programa necesita su propio asistente. Sigue sus pasos en la ventana que se abre.') ('This program needs its own uninstaller. Follow the window that opens.')
    Send-Log 'aviso' 'No se pudo en silencio: se abre su propio asistente. Sigue sus pasos.' 'Silent mode failed: its own wizard opens. Follow its steps.' $cmd
    try {
        if ($cmd -match 'msiexec' -and $cmd -match '(\{[0-9A-Fa-f\-]{36}\})') {
            $proc = Start-Process -FilePath "$env:windir\System32\msiexec.exe" -ArgumentList ('/x ' + $Matches[1]) -PassThru
        } else {
            $c = Resolve-Uninstaller $cmd
            $proc = Start-Cmd $c.exe $c.args
        }
        Wait-Uninstall $proc $key 1800
        $result.metodo = 'asistente'
        $result.ok = Test-Gone $key
        if (-not $result.ok -and -not $result.mensaje) { $result.mensaje = 'El asistente del programa se cerró sin desinstalarlo (¿lo cancelaste?). No se tocó nada.' }
    } catch {
        $result.mensaje = Get-MensajeClaro $_.Exception.Message
    }
}

# Comprobación final: ¿se borró su entrada del registro? ¿queda su carpeta?
$result.registroLimpio = (-not $key) -or (Test-Gone $key)
if ($key) {
    if ($result.registroLimpio -and $result.ok) { Send-Log 'ok' 'Su entrada del registro se borró' 'Its registry entry was removed' $key }
    elseif ($result.registroLimpio) { Send-Log 'info' 'Su entrada ya no está en el registro' 'Its registry entry is no longer there' $key }
    else { Send-Log 'aviso' 'Su entrada del registro sigue ahí' 'Its registry entry is still there' $key }
}
$loc = ([string]$p.carpeta).Trim('"')
$result.carpetaQueda = [bool]($loc -and (Test-Path -LiteralPath $loc))
if ($result.carpetaQueda) { Send-Log 'aviso' 'Su carpeta sigue en el disco (se revisará como resto)' 'Its folder is still on disk (checked as leftover)' $loc }
if ($result.ok) { Send-Log 'ok' ('Desinstalado correctamente (' + $result.metodo + ')') ('Uninstalled successfully (' + $result.metodo + ')') }
else { Send-Log 'error' 'No se pudo desinstalar' 'Could not uninstall' }
Write-RLLog ('Desinstalar ' + $p.nombre + ' metodo=' + $result.metodo + ' ok=' + $result.ok)
Send-Progress 100 'Listo' 'Done'
Send-Result $result
