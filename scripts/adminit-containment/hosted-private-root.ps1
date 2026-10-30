param([switch]$Create)
$ErrorActionPreference='Stop'
try {
 if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:COMPUTERNAME -eq 'ADMINIT'){throw 'guard'}
 if($env:GITHUB_RUN_ID -notmatch '^[1-9][0-9]+$' -or $env:GITHUB_RUN_ATTEMPT -notmatch '^[1-9][0-9]*$'){throw 'identity'}
 $parent=[Environment]::GetFolderPath('LocalApplicationData')
 $user=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 function Confirm-TrustedDirectory([string]$Path) {
  for($p=[IO.Path]::GetFullPath($Path);$p;$p=[IO.Path]::GetDirectoryName($p)){
   if(([IO.File]::GetAttributes($p) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'reparse'}
  }
  $acl=Get-Acl -LiteralPath $Path
  $allowed=@($user,'S-1-5-18','S-1-5-32-544')
  if($allowed -notcontains $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value){throw 'owner'}
  $userWrite=$false
  foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
   if($rule.AccessControlType -ne 'Allow' -or ($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -ne 0 -or ([int]$rule.FileSystemRights -band (2 -bor 4 -bor 16 -bor 64 -bor 256 -bor 65536 -bor 262144 -bor 524288)) -eq 0){continue}
   if($allowed -notcontains $rule.IdentityReference.Value){throw 'untrusted writer'}
   if($rule.IdentityReference.Value -eq $user){$userWrite=$true}
  }
  if(-not $userWrite){throw 'user write unavailable'}
 }
 Confirm-TrustedDirectory $parent
 $root=Join-Path $parent ('MathNativeHosted-'+$env:GITHUB_RUN_ID+'-'+$env:GITHUB_RUN_ATTEMPT)
 if($Create){if(Test-Path -LiteralPath $root){throw 'not fresh'};[IO.Directory]::CreateDirectory($root)|Out-Null}
 if(-not (Test-Path -LiteralPath $root -PathType Container)){throw 'missing'}
 Confirm-TrustedDirectory $root
 Write-Output $root
} catch { throw 'Existing private hosted parent does not satisfy trust policy: BLOCKED; no ACL changes attempted' }
