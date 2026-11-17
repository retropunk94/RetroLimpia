# Actualizaciones SOLO desde fuentes oficiales:
#  - Windows Update (Windows, seguridad y drivers certificados por Microsoft)
#  - winget (el gestor oficial de apps de Microsoft) para programas
# Acciones: buscar, instalarWU, winget
# Ojo: PowerShell no distingue mayúsculas ($P y $p serían la misma variable)
param([Alias('P')][string]$EntradaB64)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $EntradaB64

function Get-Winget {
    $cmd = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $alt = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\winget.exe'
    if (Test-Path -LiteralPath $alt) { return $alt }
    return $null
}

# Lee la tabla de "winget upgrade" sin depender del idioma de Windows
function Get-WingetUpgrades {
    param([string]$Exe)
    $raw = & $Exe upgrade --include-unknown --accept-source-agreements --disable-interactivity 2>$null
    $lines = @($raw | ForEach-Object { ($_ -replace "`r", '') -replace '^.*\x08', '' })
    $hdr = -1
    for ($i = 0; $i -lt $lines.Count - 1; $i++) { if ($lines[$i + 1] -match '^-{10,}') { $hdr = $i; break } }
    if ($hdr -lt 0) { return @() }
    $h = $lines[$hdr]
    $starts = @([regex]::Matches($h, '(?<=^|\s)\S') | ForEach-Object { $_.Index })
    if ($starts.Count -lt 4) { return @() }
    $out = New-Object System.Collections.Generic.List[object]
    for ($i = $hdr + 2; $i -lt $lines.Count; $i++) {
        $l = $lines[$i]
        if ($l.Length -lt $starts[3]) { continue }
        $cut = { param($a, $b) if ($b -and $b -le $l.Length) { $l.Substring($a, $b - $a).Trim() } else { $l.Substring([Math]::Min($a, $l.Length)).Trim() } }
        $name = & $cut $starts[0] $starts[1]
        $id = & $cut $starts[1] $starts[2]
        $cur = & $cut $starts[2] $starts[3]
        $new = & $cut $starts[3] $(if ($starts.Count -gt 4) { $starts[4] } else { $null })
        if ($id -match '^\S+$' -and $id -match '\.' -and $new) {
            $out.Add(@{ nombre = $name; id = $id; actual = $cur; nueva = $new })
        }
    }
    return $out.ToArray()
}

function Get-WUSession { return New-Object -ComObject Microsoft.Update.Session }

switch ($p.accion) {
    'buscar' {
        $wu = New-Object System.Collections.Generic.List[object]
        $wuError = ''
        if ($p.windows -ne $false) {
            Send-Progress 10 'Preguntando a Windows Update (puede tardar 1-3 minutos)...' 'Asking Windows Update (may take 1-3 minutes)...'
            try {
                $s = Get-WUSession
                $searcher = $s.CreateUpdateSearcher()
                $res = $searcher.Search('IsInstalled=0 and IsHidden=0')
                foreach ($u in $res.Updates) {
                    $cats = @($u.Categories | ForEach-Object { $_.Name })
                    $isDriver = ($u.Type -eq 2)
                    $isUpgrade = ($cats -match 'Upgrades|Actualizaciones de características')
                    $wu.Add(@{
                        id          = $u.Identity.UpdateID
                        titulo      = $u.Title
                        tipo        = $(if ($isDriver) { 'driver' } elseif ($cats -match 'Security|Seguridad|Critical|Crítica') { 'seguridad' } else { 'windows' })
                        opcional    = [bool]$u.BrowseOnly
                        grande      = [bool]$isUpgrade
                        tamano      = [int64]$u.MaxDownloadSize
                        kb          = (@($u.KBArticleIDs) -join ',')
                        reinicio    = ($u.InstallationBehavior.RebootBehavior -ne 0)
                        descripcion = [string]$u.Description
                    })
                }
            } catch { $wuError = $_.Exception.Message }
        }
        $apps = @(); $wingetOk = $false
        if ($p.apps -ne $false) {
            Send-Progress 70 'Buscando actualizaciones de tus programas...' 'Looking for program updates...'
            $wg = Get-Winget
            if ($wg) { $wingetOk = $true; try { $apps = Get-WingetUpgrades $wg } catch {} }
        }
        Send-Progress 100 'Listo' 'Done'
        Send-Result @{ windows = $wu.ToArray(); apps = @($apps); wingetDisponible = $wingetOk; error = $wuError }
    }
    'instalarWU' {
        $s = Get-WUSession
        $searcher = $s.CreateUpdateSearcher()
        Send-Progress 3 'Preparando actualizaciones...' 'Preparing updates...'
        $res = $searcher.Search('IsInstalled=0 and IsHidden=0')
        $ids = @($p.ids)
        $sel = @()
        foreach ($u in $res.Updates) {
            $cats = @($u.Categories | ForEach-Object { $_.Name })
            if ($p.todos) {
                if ($u.BrowseOnly -and $u.Type -ne 2) { continue }      # opcionales de Windows: no
                if ($cats -match 'Upgrades') { continue }               # cambio de versión de Windows: solo a mano
                if ($u.Title -match 'Preview|Vista previa') { continue }
                $sel += $u
            } elseif ($ids -contains $u.Identity.UpdateID) { $sel += $u }
        }
        $results = New-Object System.Collections.Generic.List[object]
        $reboot = $false
        $n = 0
        foreach ($u in $sel) {
            $n++
            $pct = [int](100 * ($n - 1) / [Math]::Max(1, $sel.Count))
            Send-Progress $pct ("($n/$($sel.Count)) Descargando e instalando: " + $u.Title) ("($n/$($sel.Count)) Downloading and installing: " + $u.Title)
            try {
                if (-not $u.EulaAccepted) { $u.AcceptEula() }
                $coll = New-Object -ComObject Microsoft.Update.UpdateColl
                [void]$coll.Add($u)
                $dl = $s.CreateUpdateDownloader(); $dl.Updates = $coll; [void]$dl.Download()
                $inst = $s.CreateUpdateInstaller(); $inst.Updates = $coll
                $r = $inst.Install()
                if ($r.RebootRequired) { $reboot = $true }
                $results.Add(@{ id = $u.Identity.UpdateID; titulo = $u.Title; ok = ($r.ResultCode -eq 2 -or $r.ResultCode -eq 3) })
            } catch {
                $results.Add(@{ id = $u.Identity.UpdateID; titulo = $u.Title; ok = $false; error = $_.Exception.Message })
            }
        }
        Write-RLLog ('Windows Update: ' + $sel.Count + ' instaladas, reinicio=' + $reboot)
        Send-Progress 100 'Listo' 'Done'
        Send-Result @{ resultados = $results.ToArray(); reinicio = $reboot }
    }
    'winget' {
        $wg = Get-Winget
        if (-not $wg) { Send-Result @{ ok = $false; mensaje = 'winget no está disponible' }; return }
        $common = @('--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
        $results = New-Object System.Collections.Generic.List[object]
        $ids = @($p.ids)
        if ($p.todos) { $ids = @(Get-WingetUpgrades $wg | ForEach-Object { $_.id }) }
        $n = 0
        foreach ($id in $ids) {
            $n++
            Send-Progress ([int](100 * ($n - 1) / [Math]::Max(1, $ids.Count))) ("($n/$($ids.Count)) Actualizando $id...") ("($n/$($ids.Count)) Updating $id...")
            $null = & $wg upgrade --id $id -e @common 2>&1
            $results.Add(@{ id = $id; ok = ($LASTEXITCODE -eq 0); codigo = $LASTEXITCODE })
        }
        Write-RLLog ('winget: ' + $ids.Count + ' actualizados')
        Send-Progress 100 'Listo' 'Done'
        Send-Result @{ resultados = $results.ToArray() }
    }
    default { Send-Result @{ ok = $false } }
}
