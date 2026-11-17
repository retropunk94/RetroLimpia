# Programas que arrancan con Windows. Usa el mismo interruptor que el Administrador
# de tareas, así que todo es reversible y nada se borra.
# Acciones: listar, cambiar
# Ojo: PowerShell no distingue mayúsculas ($P y $p serían la misma variable)
param([Alias('P')][string]$EntradaB64)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $EntradaB64

$approvedBase = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved'
$sources = @(
    @{ src = 'hkcu_run';   reg = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run';             ap = "HKCU:\$approvedBase\Run" },
    @{ src = 'hklm_run';   reg = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run';             ap = "HKLM:\$approvedBase\Run" },
    @{ src = 'hklm_run32'; reg = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'; ap = "HKLM:\$approvedBase\Run32" },
    @{ src = 'user_dir';   dir = [Environment]::GetFolderPath('Startup');                            ap = "HKCU:\$approvedBase\StartupFolder" },
    @{ src = 'common_dir'; dir = [Environment]::GetFolderPath('CommonStartup');                      ap = "HKLM:\$approvedBase\StartupFolder" }
)

function Get-Enabled {
    param([string]$ApKey, [string]$Name)
    try {
        $v = (Get-ItemProperty -LiteralPath $ApKey -Name $Name -ErrorAction Stop).$Name
        if ($v -and $v.Length -gt 0) { return (($v[0] -band 1) -eq 0) }
    } catch {}
    return $true
}

switch ($p.accion) {
    'listar' {
        $items = New-Object System.Collections.Generic.List[object]
        foreach ($s in $sources) {
            if ($s.reg) {
                if (-not (Test-Path $s.reg)) { continue }
                $props = Get-ItemProperty -LiteralPath $s.reg -ErrorAction SilentlyContinue
                foreach ($pr in $props.PSObject.Properties) {
                    if ($pr.Name -like 'PS*') { continue }
                    $items.Add(@{ id = $s.src + '|' + $pr.Name; nombre = $pr.Name; comando = [string]$pr.Value; origen = $s.src; activo = (Get-Enabled $s.ap $pr.Name) })
                }
            } elseif ($s.dir -and (Test-Path -LiteralPath $s.dir)) {
                Get-ChildItem -LiteralPath $s.dir -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'desktop.ini' } | ForEach-Object {
                    $items.Add(@{ id = $s.src + '|' + $_.Name; nombre = $_.BaseName; comando = $_.FullName; origen = $s.src; activo = (Get-Enabled $s.ap $_.Name) })
                }
            }
        }
        Send-Result @{ elementos = $items.ToArray() }
    }
    'cambiar' {
        $parts = ([string]$p.id) -split '\|', 2
        $s = $sources | Where-Object { $_.src -eq $parts[0] } | Select-Object -First 1
        if (-not $s) { Send-Result @{ ok = $false }; return }
        $ok = $false
        try {
            if (-not (Test-Path $s.ap)) { New-Item -Path $s.ap -Force | Out-Null }
            $bytes = New-Object byte[] 12
            if ($p.activar) { $bytes[0] = 2 } else {
                $bytes[0] = 3
                $ft = [BitConverter]::GetBytes((Get-Date).ToFileTime())
                [Array]::Copy($ft, 0, $bytes, 4, 8)
            }
            New-ItemProperty -LiteralPath $s.ap -Name $parts[1] -PropertyType Binary -Value $bytes -Force | Out-Null
            $ok = $true
        } catch {}
        Write-RLLog ('Inicio ' + $parts[1] + ' activo=' + [bool]$p.activar + ' ok=' + $ok)
        Send-Result @{ ok = $ok }
    }
    default { Send-Result @{ ok = $false } }
}
