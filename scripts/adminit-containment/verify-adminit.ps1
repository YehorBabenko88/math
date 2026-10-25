param([Parameter(Mandatory=$true)][string]$PackageRoot,[Parameter(Mandatory=$true)][string]$ExpectedManifestSha256,[Parameter(Mandatory=$true)][string]$ExpectedSourceHead,[switch]$Execute)
$ErrorActionPreference='Stop'
# This trusted auditor kit must be authenticated separately before invocation.
# No test executable is loaded or run by this verifier.
if($Execute){throw 'ADMINIT isolation criteria not integrated: BLOCKED; no local process may launch'}
if($env:OS -ne 'Windows_NT'){throw 'Windows required: BLOCKED'}
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$principal=New-Object Security.Principal.WindowsPrincipal($identity)
if($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Elevated token BLOCKED'}
if($env:NODE_OPTIONS -or $env:NODE_PATH){throw 'Node preloader environment BLOCKED'}
$node=@(Get-Command node.exe -CommandType Application -ErrorAction Stop)[0].Source
$lab=[IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MathUniverseLab/AdminitSynthetic'))
$path=[IO.Path]::GetFullPath($PackageRoot)
if(-not $path.StartsWith($lab+'\',[StringComparison]::OrdinalIgnoreCase) -or $PackageRoot -cne $path){throw 'Literal owned laboratory descendant required: BLOCKED'}
for($p=$path;$p;$p=[IO.Path]::GetDirectoryName($p)){
 if((Get-Item -LiteralPath $p -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse ancestor BLOCKED'}
}
$acl=Get-Acl -LiteralPath $path
if($acl.Owner -ne $identity.Name -and $acl.Owner -ne $identity.User.Value){throw 'Package directory ownership BLOCKED'}
$allowed=@($identity.User.Value,'S-1-5-18','S-1-5-32-544')
foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
 $write=2 -bor 4 -bor 16 -bor 64 -bor 256 -bor 65536 -bor 262144 -bor 524288
 if($rule.AccessControlType -eq 'Allow' -and ($rule.FileSystemRights -band $write) -ne 0 -and $allowed -notcontains $rule.IdentityReference.Value){throw 'Other principal can modify package directory: BLOCKED'}
}
& $node (Join-Path $PSScriptRoot 'package.mjs') $PackageRoot $ExpectedManifestSha256 $ExpectedSourceHead
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
Write-Output 'PACKAGE VERIFIED ONLY; token integrity, native acceptance and external isolation are not proved here. LOCAL EXECUTION BLOCKED. Q01 OPEN; G1 BLOCKED.'
