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
    if ($Cmd.StartsWith('"')) {
        $end = $Cmd.IndexOf('"', 1)
        if ($end -gt 1) { return @{ exe = $Cmd.Substring(1, $end - 1); args = $Cmd.Substring($end + 1).Trim() } }
    }
    $m = [regex]::Match($Cmd, '^(.+?\.exe)(\s+.*)?$', 'IgnoreCase')
    if ($m.Success) { return @{ exe = $m.Groups[1].Value; args = $m.Groups[2].Value.Trim() } }
    return @{ exe = $Cmd; args = '' }
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
if ($p.cerrarProcesos -ne $false) { Stop-AppProcesses $p.carpeta }

$cmd = [string]$p.desinstalar
$quiet = [string]$p.desinstalarSilencioso

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

    # Espera: termina cuando desaparece su entrada. Si en 3 minutos no cambia nada, se da por cancelado.
    $sw = [Diagnostics.Stopwatch]::StartNew(); $quieto = [Diagnostics.Stopwatch]::StartNew()
    $firma = Get-Firma $loc0 $manifest; $avisado = $false
    while ($sw.Elapsed.TotalMinutes -lt 45) {
        if (Test-Gone $key) { break }
        Start-Sleep -Seconds 2
        $f2 = Get-Firma $loc0 $manifest
        if ($f2 -ne $firma) {
            $firma = $f2; $quieto.Restart()
            if (-not $avisado) { $avisado = $true; Send-Log 'paso' ($plat.nombre + ' está borrando el juego...') ($plat.nombre + ' is deleting the game...') $loc0 }
        }
        $seg = [int]$sw.Elapsed.TotalSeconds
        if ($avisado) { Send-Progress 60 ($plat.nombre + ' está borrando el juego... (' + $seg + ' s)') ($plat.nombre + ' is deleting the game... (' + $seg + ' s)') }
        else { Send-Progress 30 ('Esperando que confirmes en la ventana de ' + $plat.nombre + '... (' + $seg + ' s)') ('Waiting for you to confirm in ' + $plat.nombre + '... (' + $seg + ' s)') }
        if ($quieto.Elapsed.TotalMinutes -ge 3) { break }
    }
    # La tienda borra la carpeta justo después de la entrada: margen de 1 minuto
    if (Test-Gone $key) {
        for ($i = 0; $i -lt 30 -and $loc0 -and (Test-Path -LiteralPath $loc0); $i++) { Start-Sleep -Seconds 2 }
    }
    $result.metodo = 'plataforma'
    $result.ok = Test-Gone $key
    $result.registroLimpio = $result.ok
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

try {
    if ($cmd -match 'msiexec' -and $cmd -match '(\{[0-9A-Fa-f\-]{36}\})') {
        $guid = $Matches[1]
        Send-Log 'paso' 'Ejecutando su desinstalador (Windows Installer) en silencio' 'Running its uninstaller (Windows Installer) silently' "msiexec.exe /x $guid /qn"
        $proc = Start-Process -FilePath 'msiexec.exe' -ArgumentList "/x $guid /qn /norestart" -PassThru -WindowStyle Hidden
        $proc.WaitForExit()
        $code = $proc.ExitCode
        if ($code -eq 3010 -or $code -eq 1641) { $result.reinicio = $true }
        $result.metodo = 'msi'
        if ($code -in 0, 1605, 1614, 3010, 1641) { $result.ok = $true }
    }
    elseif ($quiet) {
        $c = Split-Command $quiet
        Send-Log 'paso' 'Ejecutando su desinstalador silencioso oficial' 'Running its official silent uninstaller' ($c.exe + ' ' + $c.args)
        $proc = Start-Cmd $c.exe $c.args -Hidden
        Wait-Uninstall $proc $key
        $result.metodo = 'silencioso-oficial'
        $result.ok = Test-Gone $key
    }
    elseif ($cmd) {
        $c = Split-Command $cmd
        $kind = Get-InstallerKind $c.exe
        $silentArgs = switch ($kind) {
            'inno'          { '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART' }
            'nsis'          { '/S' }
            'installshield' { '-s' }
            default         { $null }
        }
        if ($silentArgs) {
            $args2 = ($c.args + ' ' + $silentArgs).Trim()
            Send-Log 'paso' ('Ejecutando su desinstalador en silencio (tipo ' + $kind + ')') ('Running its uninstaller silently (' + $kind + ')') ($c.exe + ' ' + $args2)
            $proc = Start-Cmd $c.exe $args2 -Hidden
            Wait-Uninstall $proc $key
            $result.metodo = 'silencioso-' + $kind
            $result.ok = Test-Gone $key
        }
    }
} catch {
    $result.mensaje = $_.Exception.Message
}

# Último recurso: el desinstalador normal del programa (una ventana, inevitable)
if (-not $result.ok -and $cmd -and $p.permitirVentana -ne $false) {
    Send-Progress 50 ('Este programa necesita su propio asistente. Sigue sus pasos en la ventana que se abre.') ('This program needs its own uninstaller. Follow the window that opens.')
    Send-Log 'aviso' 'No admite modo silencioso: se abre su propio asistente. Sigue sus pasos.' 'No silent mode: its own wizard opens. Follow its steps.' $cmd
    try {
        if ($cmd -match 'msiexec' -and $cmd -match '(\{[0-9A-Fa-f\-]{36}\})') {
            $proc = Start-Process -FilePath 'msiexec.exe' -ArgumentList ('/x ' + $Matches[1]) -PassThru
        } else {
            $c = Split-Command $cmd
            $proc = Start-Cmd $c.exe $c.args
        }
        Wait-Uninstall $proc $key 1800
        $result.metodo = 'asistente'
        $result.ok = Test-Gone $key
    } catch {
        $result.mensaje = $_.Exception.Message
    }
}

# Comprobación final: ¿se borró su entrada del registro? ¿queda su carpeta?
$result.registroLimpio = (-not $key) -or (Test-Gone $key)
if ($key) {
    if ($result.registroLimpio) { Send-Log 'ok' 'Su entrada del registro se borró' 'Its registry entry was removed' $key }
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
