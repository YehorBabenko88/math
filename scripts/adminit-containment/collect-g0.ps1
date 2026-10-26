# Preparation only: no ADMINIT execution is authorized by this file.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$SourceCheckout)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$checks=@{path='UNKNOWN';acl='UNKNOWN';token='UNKNOWN';firewall='UNKNOWN'}
$network=@{activeProfiles=$null;applicableRules=$null;effectiveIsolation='UNPROVEN';loopbackProtection='UNPROVEN'}
function Test-NoReparseAncestors([string]$Path) {
 $drive=[IO.Path]::GetPathRoot($Path);$current=$drive
 $paths=New-Object 'System.Collections.Generic.List[string]';$paths.Add($drive)
 foreach($part in $Path.Substring($drive.Length).Split('\')) {if($part){$current=Join-Path $current $part;$paths.Add($current)}}
 foreach($p in $paths) { $entry=Get-Item -LiteralPath $p -Force -ErrorAction Stop
  if(-not $entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)){return $false}
 }
 return $true
}
try {
 if($env:OS -ne 'Windows_NT' -or $PSVersionTable.PSVersion.Major -lt 5){throw 'blocked'}
 $root=[IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MathUniverseAdminitAcceptance'))
 $source=[IO.Path]::GetFullPath($SourceCheckout)
 if($source -ine $SourceCheckout -or $source.StartsWith('\\') -or $source.Substring(3).Contains(':') -or $source -match '~[0-9]' -or -not $source.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
 if(-not (Test-NoReparseAncestors $source)){throw 'blocked'}
 $checks.path='PASS'
 . (Join-Path $PSScriptRoot 'g0-readonly-helpers.ps1')
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
 $principal=New-Object Security.Principal.WindowsPrincipal($identity)
 $allowed=@($identity.User.Value,'S-1-5-18','S-1-5-32-544')
 # Conservative grant inventory, not an effective-access proof. Deny ACEs never cancel a suspicious grant here.
 $aclStatus='PASS'
 foreach($path in @(Get-G0AclInspectionPaths $root $source)) {
  $acl=Get-Acl -LiteralPath $path -ErrorAction Stop
  $owner=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
  if($allowed -notcontains $owner){$aclStatus='FAIL'}
  foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
   $writeMask=2 -bor 4 -bor 16 -bor 64 -bor 256 -bor 65536 -bor 262144 -bor 524288
   if($rule.AccessControlType -eq 'Allow' -and ($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -eq 0 -and ($rule.FileSystemRights -band $writeMask) -ne 0 -and $allowed -notcontains $rule.IdentityReference.Value){$aclStatus='FAIL'}
  }
 }
 $checks.acl=$aclStatus
 # Current-process Token API observation only; never fall back to CSV.
 . (Join-Path $PSScriptRoot 'g0-token-api.ps1')
 $tokenObservation=Get-G0StructuredTokenObservation
 $checks.token=$tokenObservation.status
 # ActiveStore inspection only. No connectivity/port probe and no database/service access.
 try {
  $profiles=@(Get-NetConnectionProfile -ErrorAction Stop)
  $names=@($profiles|ForEach-Object {switch($_.NetworkCategory.ToString()){'DomainAuthenticated'{'Domain'}'Private'{'Private'}'Public'{'Public'}default{throw 'blocked'}}}|Select-Object -Unique)
  if($names.Count -eq 0){throw 'blocked'}
  $rules=@(Get-NetFirewallRule -PolicyStore ActiveStore -Enabled True -ErrorAction Stop)
  if($rules.Count -gt 4096){throw 'blocked'}
  $applicable=@($rules|Where-Object {$p=$_.Profile.ToString();$match=$p -eq 'Any';foreach($n in $names){if($p -match ('(^|,\s*)'+$n+'(,|$)')){$match=$true}};$match})
  $network.activeProfiles=$names.Count;$network.applicableRules=$applicable.Count
  $fp=@(Get-NetFirewallProfile -PolicyStore ActiveStore -ErrorAction Stop|Where-Object {$names -contains $_.Name.ToString()})
  if($fp.Count -ne $names.Count){throw 'blocked'}
  $checks.firewall='PASS';foreach($f in $fp){if($f.Enabled.ToString() -ne 'True'){$checks.firewall='FAIL'}}
 } catch {$checks.firewall='UNKNOWN'}
} catch {if($checks.path -eq 'UNKNOWN'){$checks.path='FAIL'}}
# Only normalized observations leave this process. Raw SID/path/ACL/rule data never does.
@{schema='math.adminit.g0-observation.v1';observedAt=[DateTime]::UtcNow.ToString('o');readOnly=$true;rootScope='SEPARATE_NEW_ROOT';checks=$checks;network=$network;protectedServicesContacted=$false;authority='NONE';localExecute=$false}|ConvertTo-Json -Depth 4 -Compress
# Even a complete observation is not admission.
exit 2
