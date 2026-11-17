# RetroLimpia - funciones comunes para todos los scripts.
# Compatible con Windows PowerShell 5.1 (el que viene con Windows 10/11).

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}

$Global:RLBase = Join-Path $env:ProgramData 'RetroLimpia'

function Send-Progress {
    param([int]$Pct, [string]$Es, [string]$En = '')
    if (-not $En) { $En = $Es }
    $line = '@@PROGRESS ' + (@{ pct = $Pct; msg = $Es; en = $En } | ConvertTo-Json -Compress)
    [Console]::Out.WriteLine($line)
    [Console]::Out.Flush()
}

function Send-Result {
    param($Obj)
    $json = ConvertTo-Json -InputObject $Obj -Depth 8 -Compress
    [Console]::Out.WriteLine('@@RESULT ' + $json)
    [Console]::Out.Flush()
}

function Read-Params {
    param([string]$B64)
    if (-not $B64) { return [pscustomobject]@{} }
    $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($B64))
    if (-not $json -or $json -eq '{}') { return [pscustomobject]@{} }
    return ($json | ConvertFrom-Json)
}

function Get-RLFolder {
    param([string]$Sub)
    $p = Join-Path $Global:RLBase $Sub
    if (-not (Test-Path -LiteralPath $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
    return $p
}

function Write-RLLog {
    param([string]$Msg)
    try {
        $f = Join-Path (Get-RLFolder 'logs') ('{0:yyyy-MM}.log' -f (Get-Date))
        Add-Content -LiteralPath $f -Value ('[{0:yyyy-MM-dd HH:mm:ss}] {1}' -f (Get-Date), $Msg) -Encoding UTF8
    } catch {}
}

function Get-PathSize {
    param([string]$Path)
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return [int64]0 }
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if (-not $item) { return [int64]0 }
    if (-not $item.PSIsContainer) { return [int64]$item.Length }
    $sum = (Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    if ($sum) { return [int64]$sum } else { return [int64]0 }
}

# Rutas que RetroLimpia NUNCA toca, pase lo que pase.
function Test-ProtectedPath {
    param([string]$Path)
    if (-not $Path) { return $true }
    $p = $Path.TrimEnd('\').ToLowerInvariant()
    $blocked = @(
        $env:SystemDrive, $env:windir, "$env:windir\System32", "$env:windir\SysWOW64",
        $env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramData, $env:APPDATA, $env:LOCALAPPDATA,
        "$env:LOCALAPPDATA\Programs", $env:USERPROFILE, "$env:USERPROFILE\Documents", "$env:USERPROFILE\Desktop",
        "$env:ProgramFiles\Common Files", "${env:ProgramFiles(x86)}\Common Files",
        "$env:ProgramFiles\WindowsApps", "$env:ProgramData\Microsoft", "$env:APPDATA\Microsoft", "$env:LOCALAPPDATA\Microsoft",
        "$env:ProgramFiles\Microsoft", "${env:ProgramFiles(x86)}\Microsoft", "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
        "$env:APPDATA\Microsoft\Windows\Start Menu\Programs", $Global:RLBase
    ) | Where-Object { $_ } | ForEach-Object { $_.TrimEnd('\').ToLowerInvariant() }
    if ($blocked -contains $p) { return $true }
    if ($p.StartsWith(($env:windir).ToLowerInvariant())) { return $true }
    if ($p.StartsWith($Global:RLBase.ToLowerInvariant())) { return $true }
    if ($p -match '\\(windows defender|windows nt|windowsapps|windows kits|dotnet|microsoft\.net|common files)(\\|$)') { return $true }
    return $false
}

function Format-WmiDate {
    param($d)
    if (-not $d) { return '' }
    try {
        if ($d -is [datetime]) { return $d.ToString('yyyy-MM-dd') }
        return ([Management.ManagementDateTimeConverter]::ToDateTime([string]$d)).ToString('yyyy-MM-dd')
    } catch { return '' }
}
