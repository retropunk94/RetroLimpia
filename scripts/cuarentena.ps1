# Cuarentena: en vez de borrar, RetroLimpia mueve los restos aquí durante unos días.
# Si algo deja de funcionar, se pueden restaurar con un clic. Después se borran solos.
# Acciones: mover, listar, restaurar, purgar
# Ojo: PowerShell no distingue mayúsculas ($P y $p serían la misma variable)
param([Alias('P')][string]$EntradaB64)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $EntradaB64
$root = Get-RLFolder 'Cuarentena'

function Move-Safe {
    param([string]$From, [string]$To)
    $parent = Split-Path -Parent $To
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    try { Move-Item -LiteralPath $From -Destination $To -Force -ErrorAction Stop; return $true }
    catch {
        # Entre discos distintos Move-Item falla con carpetas: copiar y luego borrar
        try {
            Copy-Item -LiteralPath $From -Destination $To -Recurse -Force -ErrorAction Stop
            Remove-Item -LiteralPath $From -Recurse -Force -ErrorAction Stop
            return $true
        } catch { return $false }
    }
}

switch ($p.accion) {
    'mover' {
        $id = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + (Get-Random -Maximum 9999)
        $dir = Join-Path $root $id
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        $saved = New-Object System.Collections.Generic.List[object]
        $failed = New-Object System.Collections.Generic.List[object]
        $items = @($p.items)
        $i = 0
        foreach ($it in $items) {
            $i++
            Send-Progress ([int](100 * $i / [Math]::Max(1, $items.Count))) ('Guardando en cuarentena: ' + $it.ruta) ('Quarantining: ' + $it.ruta)
            $dest = Join-Path $dir ('{0:D3}' -f $i)
            if ($it.tipo -eq 'registro') {
                $regFile = $dest + '.reg'
                $null = & reg.exe export $it.ruta $regFile /y 2>&1
                if ((Test-Path -LiteralPath $regFile)) {
                    try {
                        Remove-Item -LiteralPath ('Registry::' + $it.ruta) -Recurse -Force -ErrorAction Stop
                        $saved.Add(@{ tipo = 'registro'; origen = $it.ruta; guardado = $regFile; tamano = 0 })
                        Send-Log 'ok' 'Entrada del registro copiada a la cuarentena y borrada' 'Registry entry backed up to quarantine and removed' $it.ruta
                    } catch { $failed.Add(@{ ruta = $it.ruta; error = $_.Exception.Message }) }
                } else { $failed.Add(@{ ruta = $it.ruta; error = 'No se pudo respaldar la clave' }) }
            } else {
                if (Test-ProtectedPath $it.ruta) { $failed.Add(@{ ruta = $it.ruta; error = 'Ruta protegida' }); continue }
                $size = Get-PathSize $it.ruta
                $target = Join-Path $dest (Split-Path -Leaf $it.ruta)
                if (Move-Safe $it.ruta $target) {
                    $saved.Add(@{ tipo = $it.tipo; origen = $it.ruta; guardado = $target; tamano = $size })
                    $tam = $(if ($size -ge 1MB) { [string][math]::Round($size / 1MB, 1) + ' MB' } else { [string][math]::Max(1, [math]::Round($size / 1KB)) + ' KB' })
                    Send-Log 'ok' ('Movido a la cuarentena (' + $tam + ')') ('Moved to quarantine (' + $tam + ')') $it.ruta
                } else { $failed.Add(@{ ruta = $it.ruta; error = 'En uso o sin permiso' }); Send-Log 'error' 'No se pudo mover (en uso o sin permiso)' 'Could not move (in use or no permission)' $it.ruta }
            }
        }
        Send-Log 'info' 'Todo lo quitado está guardado aquí unos días por si quieres restaurarlo' 'Everything removed is kept here for a few days in case you want to restore it' $dir
        $manifest = @{ id = $id; fecha = (Get-Date).ToString('o'); motivo = [string]$p.motivo; items = $saved.ToArray() }
        $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $dir 'manifest.json') -Encoding UTF8
        Write-RLLog ('Cuarentena ' + $id + ': ' + $saved.Count + ' guardados, ' + $failed.Count + ' fallidos')
        $bytes = [int64]0; foreach ($x in $saved) { $bytes += [int64]$x.tamano }
        Send-Result @{ id = $id; guardados = $saved.Count; fallidos = $failed.ToArray(); bytes = $bytes }
    }
    'listar' {
        $list = New-Object System.Collections.Generic.List[object]
        Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $mf = Join-Path $_.FullName 'manifest.json'
            if (Test-Path -LiteralPath $mf) {
                try {
                    $m = Get-Content -LiteralPath $mf -Raw -Encoding UTF8 | ConvertFrom-Json
                    $bytes = ($m.items | Measure-Object -Property tamano -Sum).Sum
                    $list.Add(@{ id = $m.id; fecha = $m.fecha; motivo = $m.motivo; cantidad = @($m.items).Count; bytes = [int64]$bytes; items = @($m.items) })
                } catch {}
            }
        }
        Send-Result @{ lotes = @($list | Sort-Object { $_.fecha } -Descending) }
    }
    'restaurar' {
        $dir = Join-Path $root ([IO.Path]::GetFileName([string]$p.id))
        $mf = Join-Path $dir 'manifest.json'
        if (-not (Test-Path -LiteralPath $mf)) { Send-Result @{ ok = $false; mensaje = 'No existe' }; return }
        $m = Get-Content -LiteralPath $mf -Raw -Encoding UTF8 | ConvertFrom-Json
        $ok = 0; $bad = 0
        foreach ($it in @($m.items)) {
            if ($it.tipo -eq 'registro') {
                $null = & reg.exe import $it.guardado 2>&1
                if ($LASTEXITCODE -eq 0) { $ok++ } else { $bad++ }
            } else {
                if (Move-Safe $it.guardado $it.origen) { $ok++ } else { $bad++ }
            }
        }
        if ($bad -eq 0) { Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue }
        Write-RLLog ('Restaurado lote ' + $m.id + ': ' + $ok + ' ok, ' + $bad + ' fallidos')
        Send-Result @{ ok = ($bad -eq 0); restaurados = $ok; fallidos = $bad }
    }
    'purgar' {
        $days = 7
        if ($p.dias) { $days = [int]$p.dias }
        $limit = (Get-Date).AddDays(-$days)
        $n = 0
        Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Where-Object { $_.CreationTime -lt $limit } | ForEach-Object {
            Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue; $n++
        }
        Send-Result @{ purgados = $n }
    }
    default { Send-Result @{ ok = $false; mensaje = 'Acción desconocida' } }
}
