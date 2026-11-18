# ¿Por qué se reinició o se apagó mi PC? Lee el registro de eventos de Windows (solo lectura)
# y traduce cada apagado/reinicio de los últimos 30 días a lenguaje sencillo.
# Ojo: PowerShell no distingue mayúsculas ($P y $p serían la misma variable)
param([Alias('P')][string]$EntradaB64)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $EntradaB64

$desde = (Get-Date).AddDays(-30)
Send-Progress 20 'Leyendo el historial de Windows...' 'Reading the Windows history...'
$ev = @()
try { $ev = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Id = 41, 1074, 6008, 1001; StartTime = $desde } -MaxEvents 200 -ErrorAction Stop) } catch {}

# Pantallazos azules más comunes, explicados
$BSOD = @{
    '0x00000116' = 'La tarjeta gráfica dejó de responder (driver de vídeo o gráfica forzada/caliente).'
    '0x00000117' = 'La tarjeta gráfica dejó de responder (driver de vídeo).'
    '0x00000133' = 'Un driver se quedó colgado demasiado tiempo (suele ser un driver de disco, red o sonido viejo).'
    '0x0000001a' = 'Fallo de memoria RAM (puede ser un módulo defectuoso o un overclock/XMP inestable).'
    '0x00000050' = 'Un programa o driver leyó memoria que no debía (driver defectuoso o RAM).'
    '0x0000007e' = 'Un driver falló (suele arreglarse actualizándolo).'
    '0x0000003b' = 'Un driver o componente del sistema falló (suele ser la gráfica o el antivirus).'
    '0x00000124' = 'Fallo de hardware detectado por el procesador (temperatura, voltaje u overclock).'
    '0x000000ef' = 'Un proceso crítico de Windows se cerró (archivos de sistema dañados o disco con problemas).'
    '0x0000009f' = 'Un driver no respondió al suspender o apagar.'
    '0x000000d1' = 'Un driver (a menudo de red o wifi) accedió a memoria incorrecta.'
    '0x0000000a' = 'Un driver accedió a memoria incorrecta.'
    '0x0000001e' = 'Un driver hizo algo que Windows no supo manejar (driver defectuoso o viejo; a veces la RAM o un overclock inestable).'
    '0x00000139' = 'Un driver corrompió una estructura del sistema.'
}

$out = New-Object System.Collections.Generic.List[object]
$bugchecks = @($ev | Where-Object { $_.Id -eq 1001 -and $_.ProviderName -match 'WER-SystemErrorReporting|BugCheck' })
foreach ($e in ($ev | Sort-Object TimeCreated -Descending)) {
    $t = $e.TimeCreated
    switch ($e.Id) {
        1074 {
            $proc = [string]$e.Properties[0].Value; $motivo = [string]$e.Properties[2].Value; $tipo = [string]$e.Properties[4].Value; $usuario = [string]$e.Properties[6].Value
            $pn = [IO.Path]::GetFileName(($proc -replace '\s*\(.*$', '')).ToLowerInvariant()
            if ($pn -match 'trustedinstaller|musnotification|mousocoreworker|usoclient|wuauclt|tiworker|svchost' -or $motivo -match 'Update|actualiz') {
                $out.Add(@{ fecha = $t.ToString('o'); clase = 'update'; titulo = 'Windows Update reinició para instalar actualizaciones'; detalle = 'Es normal. Si te molesta que pase mientras usas el PC, elige tus "horas activas" en Configuración > Windows Update.' })
            } elseif ($pn -match 'explorer|shutdown|startmenuexperiencehost|winlogon|logonui' -or $usuario -notmatch 'SYSTEM|SISTEMA') {
                $txt = if ($tipo -match 'apag|power ?off|shutdown') { 'Lo apagaste tú' } else { 'Lo reiniciaste tú' }
                $out.Add(@{ fecha = $t.ToString('o'); clase = 'usuario'; titulo = $txt; detalle = 'Desde el menú Inicio o un programa que te lo pidió.' })
            } else {
                $out.Add(@{ fecha = $t.ToString('o'); clase = 'programa'; titulo = ('Lo reinició un programa: ' + [IO.Path]::GetFileNameWithoutExtension($pn)); detalle = 'Suele ser un instalador o un driver que necesitaba reiniciar.' })
            }
        }
        41 {
            $code = 0; try { $code = [int64]$e.Properties[0].Value } catch {}
            # ¿Hubo un pantallazo azul a la vez?
            $bc = $bugchecks | Where-Object { [Math]::Abs(($_.TimeCreated - $t).TotalMinutes) -lt 10 } | Select-Object -First 1
            if ($code -ne 0 -or $bc) {
                $hex = '0x{0:x8}' -f $code
                $msg = [string]$(if ($bc) { $bc.Message } else { '' })
                if ($msg -match '(0x[0-9a-fA-F]{8})') { $hex = $Matches[1].ToLowerInvariant() }
                $why = if ($BSOD.ContainsKey($hex)) { $BSOD[$hex] } else { 'Windows encontró un error grave y se reinició para protegerse. Si se repite, revisa drivers y temperaturas.' }
                $out.Add(@{ fecha = $t.ToString('o'); clase = 'bsod'; titulo = 'Pantallazo azul'; detalle = $why; codigo = $hex })
            } else {
                $out.Add(@{ fecha = $t.ToString('o'); clase = 'corte'; titulo = 'Se apagó de golpe'; detalle = 'Sin aviso de Windows: corte de luz, botón de encendido mantenido, o la fuente/temperatura. Si pasa jugando, vigila las temperaturas en Hardware y salud.' })
            }
        }
    }
}
# 6008 sin un 41 cercano (equipos antiguos)
foreach ($e in @($ev | Where-Object { $_.Id -eq 6008 })) {
    if (-not ($out | Where-Object { [Math]::Abs(([datetime]$_.fecha - $e.TimeCreated).TotalMinutes) -lt 15 })) {
        $out.Add(@{ fecha = $e.TimeCreated.ToString('o'); clase = 'corte'; titulo = 'Se apagó de golpe'; detalle = 'Windows no se cerró bien la vez anterior: corte de luz o botón de encendido mantenido.' })
    }
}
$lista = @($out | Sort-Object { [datetime]$_.fecha } -Descending | Select-Object -First 15)
Send-Progress 100 'Listo' 'Done'
Send-Result @{ eventos = $lista; dias = 30 }
