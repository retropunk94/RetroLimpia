# Lista los programas instalados (clásicos y de Microsoft Store).
# Ojo: PowerShell no distingue mayúsculas ($P y $p serían la misma variable)
param([Alias('P')][string]$EntradaB64)
. "$PSScriptRoot\common.ps1"
$params = Read-Params $EntradaB64

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

Send-Progress 40 'Midiendo el impacto de cada programa...' 'Measuring each program''s impact...'

# Impacto en el sistema: servicios que deja funcionando y memoria que usa ahora mismo
$services = @(Get-CimInstance Win32_Service -ErrorAction SilentlyContinue | Where-Object { $_.PathName } | ForEach-Object {
    @{ ruta = ([string]$_.PathName).Trim('"').ToLowerInvariant(); auto = ($_.StartMode -eq 'Auto'); activo = ($_.State -eq 'Running') }
})
$running = @(Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
    $pp = $null; try { $pp = $_.Path } catch {}
    if ($pp) { @{ ruta = $pp.ToLowerInvariant(); ram = [int64]$_.WorkingSet64 } }
})
foreach ($prog in $programs) {
    $svc = 0; $svcAuto = 0; $ram = [int64]0; $nproc = 0
    $loc = ([string]$prog.carpeta).Trim('"').TrimEnd('\')
    if ($loc -and $loc.Length -gt 6 -and -not (Test-ProtectedPath $loc)) {
        $pre = $loc.ToLowerInvariant() + '\'
        foreach ($s in $services) { if ($s.ruta.StartsWith($pre)) { $svc++; if ($s.auto) { $svcAuto++ } } }
        foreach ($r in $running) { if ($r.ruta.StartsWith($pre)) { $ram += $r.ram; $nproc++ } }
    }
    $prog | Add-Member -NotePropertyName servicios -NotePropertyValue $svc
    $prog | Add-Member -NotePropertyName serviciosAuto -NotePropertyValue $svcAuto
    $prog | Add-Member -NotePropertyName ram -NotePropertyValue $ram
    $prog | Add-Member -NotePropertyName procesos -NotePropertyValue $nproc
}

Send-Progress 55 'Revisando apps de Microsoft Store...' 'Checking Microsoft Store apps...'

$apps = New-Object System.Collections.Generic.List[object]
try {
    $pk = Get-AppxPackage -PackageTypeFilter Main -ErrorAction Stop |
        Where-Object { -not $_.IsFramework -and $_.SignatureKind -ne 'System' -and -not $_.NonRemovable }
    foreach ($a in $pk) {
        $size = [int64]0
        $loc = ([string]$a.InstallLocation).ToLowerInvariant()
        if ($a.InstallLocation) { $size = Get-PathSize $a.InstallLocation }
        $ram = [int64]0; $nproc = 0
        if ($loc) { foreach ($r in $running) { if ($r.ruta.StartsWith($loc + '\')) { $ram += $r.ram; $nproc++ } } }
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
            ram      = $ram
            procesos = $nproc
            servicios = 0
        })
    }
} catch {
    Write-RLLog ('Get-AppxPackage falló: ' + $_.Exception.Message)
}

Send-Progress 100 'Listo' 'Done'
Send-Result @{ programas = $programs.ToArray(); apps = $apps.ToArray() }
