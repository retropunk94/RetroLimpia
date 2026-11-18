# Modo Juego: deja el PC listo para jugar y lo devuelve TODO a como estaba al terminar.
# Acciones: listar (qué hay abierto y qué conviene cerrar), activar, restaurar, estado.
# Nunca cierra nada que el usuario no haya elegido. OBS, Discord, launchers y drivers están protegidos.
# Ojo: PowerShell no distingue mayúsculas ($P y $p serían la misma variable)
param([Alias('P')][string]$EntradaB64)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $EntradaB64

$estadoFile = Join-Path $Global:RLBase 'modojuego-estado.json'
if ($p.prueba) { $estadoFile = Join-Path $env:TEMP 'rl-modojuego-prueba.json' }
$PLAN_ALTO = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'

# Lo que NUNCA se ofrece cerrar: streaming, chat de voz, launchers (los juegos los necesitan), drivers y audio
$PROTEGIDOS = '^(obs64|obs32|obs|streamlabs.*|slobs|discord|discordptb|discordcanary|teamspeak.*|ts3client.*|mumble|retrolimpia|explorer|steam|steamwebhelper|steamservice|epicgameslauncher|epicwebhelper|eadesktop|eabackgroundservice|ubisoftconnect|upc|uplaywebcore|battle\.net|agent|galaxyclient.*|riotclient.*|vgtray|leagueclient.*|nvcontainer|nvidia.*|nvsphelper64|nvdisplay\.container|amdrsserv|radeonsoftware|amdow|atieclxx|audiodg|voicemeeter.*|nahimic.*|realtek.*|rtkauduservice64|msiafterburner|rtss|rtsshooksloader64|xboxgamebar|gamebar.*|gameinputsvc|ctfmon|textinputhost|shellexperiencehost|startmenuexperiencehost|searchhost|runtimebroker|sihost|dwm|taskhostw|applicationframehost|systemsettings|securityhealthsystray|msmpeng|nissrv|lockapp|conhost|powershell|pwsh|windowsterminal|cmd|openconsole|dllhost|fontdrvhost|winlogon|csrss|lsass|services|smss|wininit|svchost|system|registry|idle|memory compression|sgrmbroker|wudfhost|spoolsv|igfx.*|intel.*|wmiprvse|smartscreen|backgroundtaskhost|crashpad_handler|msedgewebview2|razer.*|rz.*|lghub.*|logi.*|icue|corsair.*|steelseries.*|armoury.*|asus.*|elgato.*|streamdeck|stream deck|camhub|twitch.*|fifine.*|wave link|obsbot.*|vtube.*|nvidia overlay)$'
# Lo que casi nunca hace falta mientras juegas: se ofrece cerrar (marcado de inicio)
$SUGERIDOS = @{
    'onedrive' = 'Sincroniza tus archivos con la nube y usa disco e internet mientras juegas. Se vuelve a abrir al terminar.'
    'ms-teams' = 'Teams consume bastante memoria aunque no lo uses.'; 'teams' = 'Teams consume bastante memoria aunque no lo uses.'; 'msteams' = 'Teams consume bastante memoria aunque no lo uses.'
    'skype' = 'Skype en segundo plano gasta memoria.'
    'phoneexperiencehost' = '"Enlace Móvil" de Windows: conecta tu teléfono. No hace falta para jugar.'; 'yourphone' = '"Enlace Móvil" de Windows: conecta tu teléfono. No hace falta para jugar.'
    'widgets' = 'El panel de noticias y el tiempo de Windows.'; 'widgetservice' = 'El panel de noticias y el tiempo de Windows.'
    'copilot' = 'El asistente de Microsoft.'
    'googledrivefs' = 'Sincroniza Google Drive: usa disco e internet.'; 'dropbox' = 'Sincroniza Dropbox: usa disco e internet.'
    'acrotray' = 'Ayudante de Adobe Acrobat.'; 'armsvc' = 'Actualizador de Adobe.'; 'adobeupdateservice' = 'Actualizador de Adobe.'
    'creative cloud' = 'Adobe Creative Cloud en segundo plano.'; 'ccxprocess' = 'Adobe Creative Cloud en segundo plano.'; 'adobe desktop service' = 'Adobe Creative Cloud en segundo plano.'; 'coresync' = 'Sincronización de Adobe.'
    'cortana' = 'El asistente antiguo de Windows.'
    'crossdeviceservice' = 'Servicio de Windows para conectar tu teléfono y otros dispositivos.'
    'yourphoneappproxyhost' = '"Enlace Móvil" de Windows: conecta tu teléfono. No hace falta para jugar.'
    'widgetboard' = 'El panel de noticias y el tiempo de Windows.'; 'microsoftstartfeedprovider' = 'Noticias de Microsoft Start para el panel de widgets.'
    'onedrive.sync.service' = 'Sincroniza tus archivos con la nube y usa disco e internet mientras juegas.'
    'gamingservices' = $null
}
$NAVEGADORES = '^(chrome|msedge|brave|firefox|opera|opera_gx|vivaldi)$'

function Leer-Estado { if (Test-Path -LiteralPath $estadoFile) { try { return Get-Content -LiteralPath $estadoFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch {} }; return $null }
function Guardar-Estado($e) { $e | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $estadoFile -Encoding UTF8 -ErrorAction Stop }
# Procesos de ESTA sesión con ese nombre exacto (sin comodines y sin tocar otros usuarios)
function Get-Exactos([string]$n) {
    $ses = (Get-Process -Id $PID).SessionId
    return @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq $n -and $_.SessionId -eq $ses })
}
# Un solo Modo Juego a la vez (botón y modo automático nunca se pisan)
$mutex = New-Object System.Threading.Mutex($false, 'Global\RetroLimpiaModoJuego')
try { [void]$mutex.WaitOne(90000) } catch [System.Threading.AbandonedMutexException] {}

function Get-Apps {
    $sesion = (Get-Process -Id $PID).SessionId
    $win = $env:windir.ToLowerInvariant()
    $grupos = @{}
    foreach ($pr in (Get-Process -ErrorAction SilentlyContinue)) {
        if ($pr.SessionId -ne $sesion -or $pr.Id -eq $PID) { continue }
        $n = $pr.ProcessName.ToLowerInvariant()
        if ($n -match $PROTEGIDOS -and $n -notmatch $NAVEGADORES) { $prot = $true } else { $prot = $false }
        $ruta = $null; try { $ruta = $pr.Path } catch {}
        if (-not $ruta) { continue }                                  # sin acceso = de sistema: ni se muestra
        if ($ruta.ToLowerInvariant().StartsWith($win) -and -not $SUGERIDOS.ContainsKey($n)) { continue }
        if (-not $grupos.ContainsKey($n)) {
            $desc = $null; try { $desc = $pr.MainModule.FileVersionInfo.FileDescription } catch {}
            $grupos[$n] = [pscustomobject]@{ nombre = $n; titulo = $(if ($desc) { $desc } else { $pr.ProcessName }); ruta = $ruta; ram = [int64]0; ventana = $false; procesos = 0; protegido = $prot; sugerido = $false; nota = '' }
        }
        $g = $grupos[$n]; $g.ram += [int64]$pr.WorkingSet64; $g.procesos++
        if ($pr.MainWindowHandle -ne 0) { $g.ventana = $true }
    }
    foreach ($g in $grupos.Values) {
        if ($g.protegido) { continue }
        if ($SUGERIDOS.ContainsKey($g.nombre) -and $SUGERIDOS[$g.nombre]) { $g.sugerido = $true; $g.nota = $SUGERIDOS[$g.nombre] }
        elseif ($g.nombre -match $NAVEGADORES) { $g.nota = 'Navegador: si lo cierras, guarda antes lo que tengas abierto. Las pestañas suelen volver al reabrirlo.' }
        elseif ($g.ventana) { $g.nota = 'Programa abierto. Si lo cierras, guarda antes lo que estés haciendo.' }
        else { $g.nota = 'Trabaja en segundo plano.' }
    }
    return @($grupos.Values | Sort-Object -Property @{ e = 'protegido' }, @{ e = 'ram'; Descending = $true })
}

function Set-Reg($ruta, $nombre, $valor, $lista) {
    if (-not (Test-Path $ruta)) { New-Item -Path $ruta -Force | Out-Null }
    $orig = (Get-ItemProperty -Path $ruta -Name $nombre -ErrorAction SilentlyContinue).$nombre
    $lista.Add([pscustomobject]@{ ruta = $ruta; nombre = $nombre; original = $orig; existia = ($null -ne $orig) })
    Set-ItemProperty -Path $ruta -Name $nombre -Value $valor -Type DWord -Force
}

switch ($p.accion) {
    'listar' {
        $e = Leer-Estado
        Send-Result @{ apps = @(Get-Apps); activo = [bool]($e -and $e.activo); estado = $e }
    }
    'estado' { $e = Leer-Estado; Send-Result @{ activo = [bool]($e -and $e.activo); estado = $e } }
    'activar' {
        # Si ya hay un estado guardado (activo o a medias) NUNCA se activa encima: se perderían los valores originales
        $previo = Leer-Estado
        if ($previo -or (Test-Path -LiteralPath $estadoFile)) { Send-Result @{ ok = $true; yaActivo = $true; estado = $previo }; return }
        $int = [string]$p.intensidad; if ($int -notin @('suave', 'equilibrado', 'atope')) { $int = 'equilibrado' }
        $reg = New-Object System.Collections.Generic.List[object]
        $serv = New-Object System.Collections.Generic.List[string]
        $cerrados = New-Object System.Collections.Generic.List[object]
        $hecho = New-Object System.Collections.Generic.List[string]
        $noCerrados = New-Object System.Collections.Generic.List[string]
        $estado = [ordered]@{ activo = $true; desde = (Get-Date).ToString('o'); intensidad = $int; juego = [string]$p.juego; auto = [bool]$p.auto; plan = $null; reg = $reg; servicios = $serv; cerrados = $cerrados }
        # Se guarda ANTES de tocar nada: si algo se corta, siempre se puede restaurar. Si no se puede guardar, no se toca nada.
        try { Guardar-Estado $estado } catch { Send-Result @{ ok = $false; mensaje = 'No se pudo guardar el estado del Modo Juego: no se cambió nada.' }; return }

        # 1) Cerrar lo que el usuario eligió (nunca lo protegido)
        # Nunca el propio juego ni "Mis juegos"; en automático (sin nadie mirando) solo lo sugerido, que no tiene trabajo sin guardar
        $excluir = @(@($p.juegos) + @([string]$p.juego) | ForEach-Object { [IO.Path]::GetFileNameWithoutExtension([string]$_).ToLowerInvariant() } | Where-Object { $_ })
        $pedidos = @($p.cerrar | ForEach-Object { ([string]$_).ToLowerInvariant() } | Where-Object { $_ -and $_ -notmatch '[\*\?\[\]]' -and $_ -notmatch $PROTEGIDOS -and $excluir -notcontains $_ })
        if ($p.auto) { $pedidos = @($pedidos | Where-Object { $SUGERIDOS.ContainsKey($_) -and $SUGERIDOS[$_] }) }
        $i = 0
        foreach ($n in $pedidos) {
            $i++; Send-Progress ([int](40 * $i / [Math]::Max(1, $pedidos.Count))) ('Cerrando ' + $n + '...') ('Closing ' + $n + '...')
            $procs = Get-Exactos $n
            if (-not $procs.Count) { continue }
            $ruta = $null; foreach ($x in $procs) { try { if ($x.Path) { $ruta = $x.Path; break } } catch {} }
            $conVentana = @($procs | Where-Object { $_.MainWindowHandle -ne 0 }).Count -gt 0
            if ($conVentana -and -not $SUGERIDOS.ContainsKey($n)) {
                # Programa con ventana: se le PIDE cerrar, como al pulsar la X. Si pregunta "¿Guardar cambios?", se respeta
                foreach ($x in $procs) { try { if ($x.MainWindowHandle -ne 0) { [void]$x.CloseMainWindow() } } catch {} }
                $t0 = Get-Date
                while ((Get-Exactos $n).Count -and ((Get-Date) - $t0).TotalSeconds -lt 10) { Start-Sleep -Milliseconds 500 }
                # Si queda algún proceso suelto sin ventana del mismo programa, se cierra; si la ventana sigue, se deja en paz
                if (@(Get-Exactos $n | Where-Object { $_.MainWindowHandle -ne 0 }).Count) { $noCerrados.Add($n); Send-Log 'aviso' ('No se cerró ' + $n + ': puede que te esté preguntando si guardar. Ciérralo tú si quieres.') ('Did not close ' + $n); continue }
                Get-Exactos $n | Stop-Process -Force -ErrorAction SilentlyContinue
            } else {
                Get-Exactos $n | Stop-Process -Force -ErrorAction SilentlyContinue
            }
            $cerrados.Add([pscustomobject]@{ nombre = $n; ruta = $ruta })
            try { Guardar-Estado $estado } catch {}
            Send-Log 'ok' ('Cerrado: ' + $n) ('Closed: ' + $n)
        }
        if ($cerrados.Count) { $hecho.Add('cerrar') }

        # 2) Plan de energía de alto rendimiento
        Send-Progress 50 'Poniendo el PC a máxima potencia...' 'Setting maximum power...'
        try {
            $act = (& powercfg /getactivescheme) -join ' '
            if ($act -match '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') {
                $estado.plan = $Matches[1]
                $lista = (& powercfg /list) -join ' '
                if ($lista -match $PLAN_ALTO -and $estado.plan -ne $PLAN_ALTO) { & powercfg /setactive $PLAN_ALTO | Out-Null; $hecho.Add('energia') }
            }
        } catch {}
        Guardar-Estado $estado

        if ($int -ne 'suave') {
            Send-Progress 65 'Silenciando notificaciones y activando el Modo Juego de Windows...' 'Muting notifications and enabling Windows Game Mode...'
            try {
                Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications' 'ToastEnabled' 0 $reg
                Set-Reg 'HKCU:\Software\Microsoft\GameBar' 'AutoGameModeEnabled' 1 $reg
                Set-Reg 'HKCU:\Software\Microsoft\GameBar' 'AllowAutoGameMode' 1 $reg
                $hecho.Add('notificaciones')
            } catch {}
            Guardar-Estado $estado
            $paraParar = @('wuauserv', 'bits', 'dosvc')                     # descargas de Windows Update en pausa
            # Si Windows está INSTALANDO una actualización ahora mismo, no se interrumpe
            if (Get-Process -Name TrustedInstaller, TiWorker -ErrorAction SilentlyContinue) { $paraParar = @(); Send-Log 'info' 'Windows está instalando una actualización: no se pausa' 'Windows is installing an update: not paused' }
            if ($int -eq 'atope') { $paraParar += @('WSearch', 'SysMain') }  # indexado y precarga en pausa
            Send-Progress 80 'Pausando tareas de Windows que usan disco e internet...' 'Pausing Windows tasks that use disk and internet...'
            foreach ($s in $paraParar) {
                $sv = Get-Service -Name $s -ErrorAction SilentlyContinue
                if ($sv -and $sv.Status -eq 'Running') {
                    try { Stop-Service -Name $s -Force -ErrorAction Stop; $serv.Add($s) } catch {}
                }
            }
            if ($serv.Count) { $hecho.Add('servicios') }
            Guardar-Estado $estado
        }
        # 3) A tope: el juego con prioridad alta
        if ($int -eq 'atope') {
            foreach ($jn in $excluir) { Get-Exactos $jn | ForEach-Object { try { $_.PriorityClass = 'High'; $hecho.Add('prioridad') } catch {} } }
        }
        Write-RLLog ('Modo Juego activado (' + $int + '): ' + ($hecho -join ', '))
        Send-Progress 100 'Listo' 'Done'
        Send-Result @{ ok = $true; hecho = @($hecho | Select-Object -Unique); cerrados = $cerrados.Count; noCerrados = @($noCerrados); estado = $estado }
    }
    'restaurar' {
        $e = Leer-Estado
        if (-not $e) { Remove-Item -LiteralPath $estadoFile -Force -ErrorAction SilentlyContinue; Send-Result @{ ok = $true; nada = $true }; return }
        Send-Progress 20 'Devolviendo el PC a como estaba...' 'Putting your PC back as it was...'
        # SEGURIDAD: el archivo de estado solo puede devolver lo que el Modo Juego toca, nada más
        $REG_OK = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications|ToastEnabled', 'HKCU:\Software\Microsoft\GameBar|AutoGameModeEnabled', 'HKCU:\Software\Microsoft\GameBar|AllowAutoGameMode')
        $SERV_OK = @('wuauserv', 'bits', 'dosvc', 'WSearch', 'SysMain')
        if ($e.plan -and ([string]$e.plan) -match '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') { try { & "$env:windir\System32\powercfg.exe" /setactive $e.plan | Out-Null } catch {} }
        foreach ($r in @($e.reg)) {
            if ($REG_OK -notcontains ([string]$r.ruta + '|' + [string]$r.nombre)) { continue }
            try {
                if ($r.existia) { Set-ItemProperty -Path $r.ruta -Name $r.nombre -Value ([int]$r.original) -Type DWord -Force }
                else { Remove-ItemProperty -Path $r.ruta -Name $r.nombre -ErrorAction SilentlyContinue }
            } catch {}
        }
        Send-Progress 50 'Reanudando tareas de Windows...' 'Resuming Windows tasks...'
        foreach ($s in @($e.servicios)) { if ($SERV_OK -notcontains [string]$s) { continue }; try { Start-Service -Name $s -ErrorAction Stop } catch {} }
        $reabiertos = 0
        if ($p.reabrir) {
            Send-Progress 75 'Volviendo a abrir lo que se cerró...' 'Reopening what was closed...'
            foreach ($c in @($e.cerrados)) {
                if (-not $c.ruta -or ([string]$c.ruta) -notmatch '^[A-Za-z]:\\.+\.exe$' -or -not (Test-Path -LiteralPath $c.ruta)) { continue }
                if ((Get-Exactos ([string]$c.nombre)).Count) { continue }
                # A través del Explorador: así se abre como usuario normal, no como administrador
                try { Start-Process -FilePath "$env:windir\explorer.exe" -ArgumentList ('"' + $c.ruta + '"'); $reabiertos++ } catch {}
            }
        }
        $mins = 0; try { $mins = [int]((Get-Date) - [datetime]$e.desde).TotalMinutes } catch {}
        Remove-Item -LiteralPath $estadoFile -Force -ErrorAction SilentlyContinue
        Write-RLLog ('Modo Juego restaurado tras ' + $mins + ' min')
        Send-Progress 100 'Listo' 'Done'
        Send-Result @{ ok = $true; minutos = $mins; reabiertos = $reabiertos }
    }
    default { Send-Result @{ ok = $false } }
}
