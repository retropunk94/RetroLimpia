# Lista los programas instalados (clásicos y de Microsoft Store).
param([string]$P)
. "$PSScriptRoot\common.ps1"
$params = Read-Params $P

Send-Progress 5 'Buscando programas instalados...' 'Looking for installed programs...'

$roots = @(
    @{ Path = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'; Scope = 'equipo' },
    @{ Path = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'; Scope = 'equipo32' },
    @{ Path = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'; Scope = 'usuario' }
)

$seen = @{}
$programs = New-Object System.Collections.Generic.List[object]

foreach ($r in $roots) {
    if (-not (Test-Path $r.Path)) { continue }
    foreach ($key in (Get-ChildItem -Path $r.Path -ErrorAction SilentlyContinue)) {
        $k = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
        if (-not $k -or -not $k.DisplayName) { continue }
        if ($k.SystemComponent -eq 1) { continue }
        if ($k.ParentKeyName) { continue }
        if ($k.ReleaseType -and ($k.ReleaseType -match 'Update|Hotfix|Security')) { continue }
        if (-not $k.UninstallString -and -not $k.QuietUninstallString) { continue }

        $name = ([string]$k.DisplayName).Trim()
        $dedup = ($name + '|' + [string]$k.DisplayVersion).ToLowerInvariant()
        if ($seen.ContainsKey($dedup)) { continue }
        $seen[$dedup] = $true

        $size = [int64]0
        if ($k.EstimatedSize) { try { $size = [int64]$k.EstimatedSize * 1024 } catch {} }
        $loc = [string]$k.InstallLocation
        if ($size -eq 0 -and $loc -and (Test-Path -LiteralPath $loc) -and -not (Test-ProtectedPath $loc)) {
            $size = Get-PathSize $loc
        }
        $fecha = ''
        if ($k.InstallDate -match '^\d{8}$') { $fecha = $k.InstallDate.Substring(0,4) + '-' + $k.InstallDate.Substring(4,2) + '-' + $k.InstallDate.Substring(6,2) }

        $programs.Add([pscustomobject]@{
            id                    = 'w:' + $key.Name
            tipo                  = 'win32'
            nombre                = $name
            editor                = [string]$k.Publisher
            version               = [string]$k.DisplayVersion
            fecha                 = $fecha
            tamano                = $size
            carpeta               = $loc
            desinstalar           = [string]$k.UninstallString
            desinstalarSilencioso = [string]$k.QuietUninstallString
            clave                 = [string]$key.Name
            ambito                = $r.Scope
            msi                   = ($k.WindowsInstaller -eq 1)
        })
    }
}

Send-Progress 55 'Revisando apps de Microsoft Store...' 'Checking Microsoft Store apps...'

$apps = New-Object System.Collections.Generic.List[object]
try {
    $pk = Get-AppxPackage -PackageTypeFilter Main -ErrorAction Stop |
        Where-Object { -not $_.IsFramework -and $_.SignatureKind -ne 'System' -and -not $_.NonRemovable }
    foreach ($a in $pk) {
        $size = [int64]0
        if ($params.tamanos -and $a.InstallLocation) { $size = Get-PathSize $a.InstallLocation }
        $apps.Add([pscustomobject]@{
            id       = 'a:' + $a.PackageFullName
            tipo     = 'appx'
            nombre   = $a.Name
            editor   = ($a.Publisher -replace '^CN=([^,]+).*$', '$1')
            version  = [string]$a.Version
            tamano   = $size
            paquete  = $a.PackageFullName
            familia  = $a.PackageFamilyName
            carpeta  = [string]$a.InstallLocation
        })
    }
} catch {
    Write-RLLog ('Get-AppxPackage falló: ' + $_.Exception.Message)
}

Send-Progress 100 'Listo' 'Done'
Send-Result @{ programas = @($programs); apps = @($apps) }
