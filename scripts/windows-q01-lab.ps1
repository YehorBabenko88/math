#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Source,
    [string]$ExpectedHead,
    [ValidateSet('quick','fault','stress')][string]$Profile = 'quick',
    [switch]$Execute
)
$script:Q01Root = 'C:\Users\Administrator\AppData\Local\MathUniverseLab'
function Test-Q01Elevated {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
function Assert-Q01NoReparse([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -Force -LiteralPath $cursor -ErrorAction Stop
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'reparse path BLOCKED' }
        }
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }; $cursor = $parent
    }
}
function Assert-Q01LabPath([string]$Path) {
    if ($Path -notmatch '^C:\\Users\\Administrator\\AppData\\Local\\MathUniverseLab(?:\\|$)' -or
        $Path -match '(^|\\)\.\.?($|\\)' -or $Path -match '[/:]' -and $Path.Substring(2) -match '[/:]' -or
        $Path -match '[ .](\\|$)') { throw 'outside literal laboratory root BLOCKED' }
    $full = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    if ($full -ne $script:Q01Root -and -not $full.StartsWith($script:Q01Root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'outside laboratory root BLOCKED' }
    Assert-Q01NoReparse $full
}
function Invoke-Q01Git([string]$Checkout, [string[]]$GitArguments) {
    # --no-optional-locks avoids index refresh writes. No status/checkout/reset commands.
    $result = & git --no-optional-locks --no-replace-objects -C $Checkout @GitArguments 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'read-only Git verification BLOCKED' }
    return $result
}
function Assert-Q01Preflight([string]$Source, [string]$ExpectedHead) {
    if (Test-Q01Elevated) { throw 'elevated session BLOCKED; use a non-elevated operator session' }
    if ($ExpectedHead -notmatch '^[0-9a-fA-F]{40}$') { throw 'full ExpectedHead required: BLOCKED' }
    if (-not [IO.Path]::IsPathRooted($Source) -or $Source -match '^[\\/]{2}|(^|[\\/])\.\.?([\\/]|$)|["\r\n]') { throw 'literal absolute Source required: BLOCKED' }
    Assert-Q01NoReparse $Source
    if (-not (Test-Path -LiteralPath $Source -PathType Container)) { throw 'missing source BLOCKED' }
    $head = Invoke-Q01Git $Source @('rev-parse','HEAD')
    if ($head -ne $ExpectedHead) { throw 'HEAD mismatch BLOCKED' }
    $top = Invoke-Q01Git $Source @('rev-parse','--show-toplevel')
    if ([IO.Path]::GetFullPath($top).TrimEnd('\') -ne [IO.Path]::GetFullPath($Source).TrimEnd('\')) { throw 'source must be checkout root: BLOCKED' }
    Assert-Q01LabPath $script:Q01Root
    if ([IO.Path]::GetFullPath($Source).StartsWith($script:Q01Root, [StringComparison]::OrdinalIgnoreCase)) { throw 'source overlaps laboratory root: BLOCKED' }
}
function Assert-Q01Unchanged([string]$Before, [string]$After) {
    if ($Before -cne $After) { throw 'source changed: BLOCKED' }
}
function Get-Q01SourceHash([string]$Checkout, [string]$Node) {
    # Read-only traversal includes untracked files and Git metadata. Rejects every link.
    $js = 'const fs=require(''fs''),p=require(''path''),c=require(''crypto'');const h=c.createHash(''sha256'');function walk(d){for(const n of fs.readdirSync(d).sort()){const f=p.join(d,n),s=fs.lstatSync(f);if(s.isSymbolicLink()||s.nlink>1&&!s.isDirectory())throw Error(''link BLOCKED'');h.update(f);if(s.isDirectory())walk(f);else if(s.isFile())h.update(fs.readFileSync(f));else throw Error(''special file BLOCKED'');}}walk(process.argv[1]);console.log(h.digest(''hex''));'
    $hash = & $Node -e $js $Checkout 2>$null
    if ($LASTEXITCODE -ne 0 -or $hash -notmatch '^[0-9a-f]{64}$') { throw 'source links/hash check BLOCKED' }
    return $hash
}
function Invoke-Q01WindowsLab {
    $ErrorActionPreference = 'Stop'
    Assert-Q01Preflight $Source $ExpectedHead
    $node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
    Assert-Q01NoReparse $node
    $version = & $node --version
    if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v(22|24)\.') { throw 'existing Node 22 or 24 required: BLOCKED' }
    $before = Get-Q01SourceHash $Source $node
    Assert-Q01Unchanged $before (Get-Q01SourceHash $Source $node)
    if (-not $Execute) {
        Write-Output 'PREPARED (read-only): guards passed; execution requires separate explicit user permission and -Execute. No laboratory run performed.'
        return 0
    }
    # Explicit switch is a mechanical guard, never proof of user authorization.
    # A process-tree kill based on a PID has a reuse race on Windows. Until an
    # inherited kill-on-close Job Object is available, fail closed before mkdir.
    throw 'execution containment unavailable: BLOCKED; Windows Job Object ownership and hard timeout are required before -Execute can run'
}
if ($MyInvocation.InvocationName -ne '.') {
    try { $code = Invoke-Q01WindowsLab; exit $code }
    catch { Write-Output ('BLOCKED: ' + $_.Exception.Message); exit 2 }
}

