# Administrador de procesos: qué está consumiendo más CPU y memoria ahora mismo.
# Acciones: listar, terminar
# Ojo: PowerShell no distingue mayúsculas ($P y $p serían la misma variable)
param([Alias('P')][string]$EntradaB64)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $EntradaB64

# Procesos que NUNCA se pueden cerrar: Windows se cuelga o se reinicia sin ellos.
$criticos = @('System', 'Idle', 'Registry', 'smss', 'csrss', 'wininit', 'winlogon', 'services', 'lsass', 'lsaiso',
              'svchost', 'fontdrvhost', 'dwm', 'Memory Compression', 'Secure System', 'MsMpEng', 'SecurityHealthService',
              'spoolsv', 'audiodg', 'conhost', 'sihost', 'ctfmon', 'RuntimeBroker', 'powershell', 'RetroLimpia')

switch ($p.accion) {
    'listar' {
        $cores = [Environment]::ProcessorCount
        $first = @{}
        foreach ($pr in (Get-Process -ErrorAction SilentlyContinue)) { try { $first[$pr.Id] = $pr.TotalProcessorTime.TotalMilliseconds } catch {} }
        $sw = [Diagnostics.Stopwatch]::StartNew()
        Start-Sleep -Milliseconds 900
        $procs = @(Get-Process -ErrorAction SilentlyContinue)
        $elapsed = $sw.Elapsed.TotalMilliseconds

        # Agrupados por nombre (Chrome abre 30 procesos: se ven como uno solo)
        $groups = @{}
        foreach ($pr in $procs) {
            $cpu = 0.0
            try {
                if ($first.ContainsKey($pr.Id)) { $cpu = ($pr.TotalProcessorTime.TotalMilliseconds - $first[$pr.Id]) / ($elapsed * $cores) * 100 }
            } catch {}
            $name = $pr.ProcessName
            if (-not $groups.ContainsKey($name)) {
                $desc = ''; $path = ''; $company = ''
                try { $desc = $pr.Description; $path = $pr.Path; $company = $pr.Company } catch {}
                $groups[$name] = @{ nombre = $name; descripcion = [string]$desc; ruta = [string]$path; empresa = [string]$company; cpu = 0.0; ram = [int64]0; cantidad = 0; pids = New-Object System.Collections.Generic.List[int]; critico = ($criticos -contains $name); ventana = $false; titulo = ''; windows = $false }
                # ¿Es parte de Windows? (carpeta de Windows o componente de Microsoft del sistema)
                if ($path -and $path.ToLowerInvariant().StartsWith(($env:windir).ToLowerInvariant())) { $groups[$name].windows = $true }
                if (-not $path -and $pr.Id -lt 1000) { $groups[$name].windows = $true }
            }
            $g = $groups[$name]
            $g.cpu += [Math]::Max([double]0, [double]$cpu)
            $g.ram += [int64]$pr.WorkingSet64
            $g.cantidad++
            $g.pids.Add($pr.Id)
            # ¿Tiene una ventana abierta? Entonces es un programa que la persona está usando
            try { if ($pr.MainWindowHandle -ne [IntPtr]::Zero -and $pr.MainWindowTitle) { $g.ventana = $true; if (-not $g.titulo) { $g.titulo = [string]$pr.MainWindowTitle } } } catch {}
        }
        $out = foreach ($g in $groups.Values) {
            @{ nombre = $g.nombre; descripcion = $g.descripcion; ruta = $g.ruta; empresa = $g.empresa; cpu = [Math]::Round($g.cpu, 1); ram = $g.ram; cantidad = $g.cantidad; pids = $g.pids.ToArray(); critico = $g.critico; ventana = $g.ventana; titulo = $g.titulo; windows = ($g.windows -or $g.critico) }
        }
        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
        $total = [int64]$os.TotalVisibleMemorySize * 1024
        $libre = [int64]$os.FreePhysicalMemory * 1024
        $cpuTotal = 0.0; foreach ($x in $out) { $cpuTotal += [double]$x.cpu }
        Send-Result @{ procesos = @($out | Sort-Object { $_.ram } -Descending); ramTotal = $total; ramLibre = $libre; cpuTotal = [Math]::Min(100, [Math]::Round($cpuTotal, 1)) }
    }
    'terminar' {
        if ($criticos -contains [string]$p.nombre) { Send-Result @{ ok = $false; mensaje = 'Proceso del sistema protegido' }; return }
        $ok = 0; $bad = 0
        foreach ($id in @($p.pids)) {
            try {
                $pr = Get-Process -Id ([int]$id) -ErrorAction Stop
                if ($criticos -contains $pr.ProcessName) { $bad++; continue }
                Stop-Process -Id ([int]$id) -Force -ErrorAction Stop; $ok++
            } catch { $bad++ }
        }
        Write-RLLog ('Procesos terminados: ' + $p.nombre + ' ok=' + $ok + ' fallidos=' + $bad)
        Send-Result @{ ok = ($ok -gt 0); terminados = $ok; fallidos = $bad }
    }
    default { Send-Result @{ ok = $false } }
}
