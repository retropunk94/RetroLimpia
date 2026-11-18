# Privacidad de Windows: quita anuncios, sugerencias y el envío de datos opcional.
# Todo es reversible: antes de cambiar un valor se guarda el original en
# C:\ProgramData\RetroLimpia\privacidad-respaldo.json, y "restaurar" lo devuelve tal cual.
# Acciones: listar, aplicar (ids), restaurar (ids)
# Ojo: PowerShell no distingue mayúsculas ($P y $p serían la misma variable)
param([Alias('P')][string]$EntradaB64)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $EntradaB64

$cdm = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager'
$adv = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'

# Cada ajuste: lista de valores del registro y el valor "privado" que se pone.
$AJUSTES = [ordered]@{
    anuncios_inicio = @(
        @{ k = $cdm; n = 'SubscribedContent-338388Enabled'; v = 0 },
        @{ k = $cdm; n = 'SystemPaneSuggestionsEnabled'; v = 0 },
        @{ k = $adv; n = 'Start_IrisRecommendations'; v = 0 })
    sugerencias_ajustes = @(
        @{ k = $cdm; n = 'SubscribedContent-338393Enabled'; v = 0 },
        @{ k = $cdm; n = 'SubscribedContent-353694Enabled'; v = 0 },
        @{ k = $cdm; n = 'SubscribedContent-353696Enabled'; v = 0 })
    consejos_windows = @(
        @{ k = $cdm; n = 'SubscribedContent-338389Enabled'; v = 0 },
        @{ k = $cdm; n = 'SoftLandingEnabled'; v = 0 },
        @{ k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\UserProfileEngagement'; n = 'ScoobeSystemSettingEnabled'; v = 0 })
    apps_solas = @(
        @{ k = $cdm; n = 'SilentInstalledAppsEnabled'; v = 0 },
        @{ k = $cdm; n = 'OemPreInstalledAppsEnabled'; v = 0 },
        @{ k = $cdm; n = 'PreInstalledAppsEnabled'; v = 0 },
        @{ k = $cdm; n = 'PreInstalledAppsEverEnabled'; v = 0 })
    pantalla_bloqueo = @(
        @{ k = $cdm; n = 'RotatingLockScreenOverlayEnabled'; v = 0 },
        @{ k = $cdm; n = 'SubscribedContent-338387Enabled'; v = 0 })
    id_publicidad = @(
        @{ k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo'; n = 'Enabled'; v = 0 })
    explorador_anuncios = @(
        @{ k = $adv; n = 'ShowSyncProviderNotifications'; v = 0 })
    bing_busqueda = @(
        @{ k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search'; n = 'BingSearchEnabled'; v = 0 },
        @{ k = 'HKCU:\Software\Policies\Microsoft\Windows\Explorer'; n = 'DisableSearchBoxSuggestions'; v = 1 })
    experiencias_personalizadas = @(
        @{ k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Privacy'; n = 'TailoredExperiencesWithDiagnosticDataEnabled'; v = 0 })
    telemetria_opcional = @(
        @{ k = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection'; n = 'AllowTelemetry'; v = 1; max = $true })   # max: si ya está más bajo (0), se respeta
    copilot = @(
        @{ k = 'HKCU:\Software\Policies\Microsoft\Windows\WindowsCopilot'; n = 'TurnOffWindowsCopilot'; v = 1 },
        @{ k = $adv; n = 'ShowCopilotButton'; v = 0 })
    # Ajustes cómodos del asistente "Acabo de formatear" (no salen en la lista de Privacidad)
    ver_extensiones = @(
        @{ k = $adv; n = 'HideFileExt'; v = 0 })
    explorador_este_equipo = @(
        @{ k = $adv; n = 'LaunchTo'; v = 1 })
}

if (-not (Test-Path -LiteralPath $Global:RLBase)) { New-Item -ItemType Directory -Path $Global:RLBase -Force | Out-Null }
$respaldoFile = Join-Path $Global:RLBase 'privacidad-respaldo.json'
# Solo para pruebas: un ajuste falso en una clave propia, sin tocar Windows
if ($p.prueba) {
    $AJUSTES = [ordered]@{ prueba = @(@{ k = 'HKCU:\Software\RetroLimpiaPrueba'; n = 'Valor'; v = 0 }, @{ k = 'HKCU:\Software\RetroLimpiaPrueba\Sub'; n = 'Nuevo'; v = 1 }) }
    $respaldoFile = Join-Path $env:TEMP 'rl-privacidad-prueba.json'
}
function Read-Respaldo {
    $h = @{}
    if (Test-Path -LiteralPath $respaldoFile) {
        try { (Get-Content -LiteralPath $respaldoFile -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $h[$_.Name] = $_.Value } } catch {}
    }
    return $h
}
function Save-Respaldo($h) { ($h | ConvertTo-Json -Depth 4) | Set-Content -LiteralPath $respaldoFile -Encoding UTF8 }

function Get-Val($k, $n) {
    try { $it = Get-ItemProperty -LiteralPath $k -Name $n -ErrorAction Stop; return $it.$n } catch { return $null }
}
function Test-Ajuste($lista) {
    foreach ($x in $lista) { $v = Get-Val $x.k $x.n; if ($null -eq $v) { return $false }; if ($x.max) { if ([int]$v -gt [int]$x.v) { return $false } } elseif ([int]$v -ne [int]$x.v) { return $false } }
    return $true
}
function Test-PuedeEscribir($lista) {
    foreach ($x in $lista) { if ($x.k -like 'HKLM:*') { if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { return $false } } }
    return $true
}

switch ($p.accion) {
    'listar' {
        $out = foreach ($id in $AJUSTES.Keys) {
            [pscustomobject]@{ id = $id; aplicado = (Test-Ajuste $AJUSTES[$id]); permitido = (Test-PuedeEscribir $AJUSTES[$id]) }
        }
        Send-Result @{ ajustes = @($out) }
    }
    'aplicar' {
        $resp = Read-Respaldo
        $res = New-Object System.Collections.Generic.List[object]
        $ids = @($p.ids); $i = 0
        foreach ($id in $ids) {
            $i++
            if (-not $AJUSTES.Contains($id)) { continue }
            Send-Progress ([int](100 * $i / [Math]::Max(1, $ids.Count))) ('Aplicando: ' + $id) ('Applying: ' + $id)
            $ok = $true
            foreach ($x in $AJUSTES[$id]) {
                $clave = $x.k + '|' + $x.n
                # Se guarda el valor original solo la primera vez (así "restaurar" vuelve al de fábrica)
                $actual = Get-Val $x.k $x.n
                if ($x.max -and $null -ne $actual -and [int]$actual -le [int]$x.v) { continue }   # nunca se sube un valor más privado
                # El original se guarda en disco ANTES de escribir: si algo se corta, no se pierde
                if (-not $resp.ContainsKey($clave)) { $resp[$clave] = @{ existe = ($null -ne $actual); valor = $actual }; Save-Respaldo $resp }
                try {
                    if (-not (Test-Path -LiteralPath $x.k)) { New-Item -Path $x.k -Force -ErrorAction Stop | Out-Null }
                    New-ItemProperty -LiteralPath $x.k -Name $x.n -PropertyType DWord -Value $x.v -Force -ErrorAction Stop | Out-Null
                } catch { $ok = $false }
            }
            $res.Add([pscustomobject]@{ id = $id; ok = $ok })
        }
        Save-Respaldo $resp
        Write-RLLog ('Privacidad aplicada: ' + ($ids -join ', '))
        Send-Result @{ resultados = $res.ToArray() }
    }
    'restaurar' {
        $resp = Read-Respaldo
        $res = New-Object System.Collections.Generic.List[object]
        foreach ($id in @($p.ids)) {
            if (-not $AJUSTES.Contains($id)) { continue }
            $ok = $true
            foreach ($x in $AJUSTES[$id]) {
                $clave = $x.k + '|' + $x.n
                try {
                    if ($resp.ContainsKey($clave)) {
                        $o = $resp[$clave]
                        if ($o.existe) { New-ItemProperty -LiteralPath $x.k -Name $x.n -PropertyType DWord -Value ([int]$o.valor) -Force -ErrorAction Stop | Out-Null }
                        else { Remove-ItemProperty -LiteralPath $x.k -Name $x.n -ErrorAction SilentlyContinue }
                        $resp.Remove($clave)
                    } else {
                        # Sin copia: se quita el valor para que Windows use el suyo de fábrica
                        Remove-ItemProperty -LiteralPath $x.k -Name $x.n -ErrorAction SilentlyContinue
                    }
                } catch { $ok = $false }
            }
            $res.Add([pscustomobject]@{ id = $id; ok = $ok })
        }
        Save-Respaldo $resp
        Write-RLLog ('Privacidad restaurada: ' + (@($p.ids) -join ', '))
        Send-Result @{ resultados = $res.ToArray() }
    }
    default { Send-Result @{ error = 'accion desconocida' } }
}
