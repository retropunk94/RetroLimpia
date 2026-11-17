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
