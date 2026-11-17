# Puntos de restauración de Windows: la red de seguridad antes de cualquier cambio.
# Acciones: crear, listar, abrir
param([string]$P)
. "$PSScriptRoot\common.ps1"
$p = Read-Params $P

switch ($p.accion) {
    'crear' {
        Send-Progress 10 'Creando un punto de restauración (tu copia de seguridad)...' 'Creating a restore point (your safety net)...'
        $ok = $false; $msg = ''
        try {
            # Windows solo permite 1 punto cada 24 h por defecto; lo permitimos siempre
            $k = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore'
            New-ItemProperty -Path $k -Name 'SystemRestorePointCreationFrequency' -Value 0 -PropertyType DWord -Force | Out-Null
            try { Enable-ComputerRestore -Drive ($env:SystemDrive + '\') -ErrorAction Stop } catch {}
            $desc = 'RetroLimpia - ' + ([string]$p.motivo)
            if ($desc.Length -gt 60) { $desc = $desc.Substring(0, 60) }
            Checkpoint-Computer -Description $desc -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop
            $ok = $true
        } catch { $msg = $_.Exception.Message }
        Write-RLLog ('Punto de restauración: ' + $ok + ' ' + $msg)
        Send-Progress 100 'Listo' 'Done'
        Send-Result @{ ok = $ok; mensaje = $msg }
    }
    'listar' {
        $list = @()
        try {
            $list = @(Get-ComputerRestorePoint -ErrorAction Stop | ForEach-Object {
                @{ numero = $_.SequenceNumber; descripcion = $_.Description; fecha = (Format-WmiDate $_.CreationTime) }
            })
        } catch {}
        Send-Result @{ puntos = $list }
    }
    'abrir' {
        Start-Process -FilePath "$env:windir\System32\rstrui.exe"
        Send-Result @{ ok = $true }
    }
    default { Send-Result @{ ok = $false } }
}
