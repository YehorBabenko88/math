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
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
 $principal=New-Object Security.Principal.WindowsPrincipal($identity)
 $allowed=@($identity.User.Value,'S-1-5-18','S-1-5-32-544')
 # Conservative grant inventory, not an effective-access proof. Deny ACEs never cancel a suspicious grant here.
 $checks.acl='PASS'
 foreach($path in @($root,$source)) {
  $acl=Get-Acl -LiteralPath $path -ErrorAction Stop
  $owner=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
  if($allowed -notcontains $owner){$checks.acl='FAIL'}
  foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
   $writeMask=2 -bor 4 -bor 16 -bor 64 -bor 256 -bor 65536 -bor 262144 -bor 524288
   if($rule.AccessControlType -eq 'Allow' -and ($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -eq 0 -and ($rule.FileSystemRights -band $writeMask) -ne 0 -and $allowed -notcontains $rule.IdentityReference.Value){$checks.acl='FAIL'}
  }
 }
 # Fixed Windows read-only utility; arguments are not supplied by the caller.
 $psi=New-Object Diagnostics.ProcessStartInfo
 $psi.FileName=Join-Path ([Environment]::GetFolderPath('System')) 'whoami.exe'
 $psi.Arguments='/groups /fo csv /nh';$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true
 $psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
 $process=New-Object Diagnostics.Process;$process.StartInfo=$psi
 try {
  if(-not $process.Start()){throw 'blocked'}
  $out=$process.StandardOutput.ReadToEndAsync();$err=$process.StandardError.ReadToEndAsync()
  if(-not $process.WaitForExit(5000)){try{$process.Kill()}catch{};throw 'blocked'}
  if($process.ExitCode -ne 0 -or $out.Result.Length -gt 65536 -or $err.Result.Length -ne 0){throw 'blocked'}
  $labels=@([regex]::Matches($out.Result,'S-1-16-[0-9]+')|ForEach-Object {$_.Value}|Select-Object -Unique)
  if($labels.Count -eq 1){if($labels[0] -eq 'S-1-16-8192' -and -not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){$checks.token='PASS'}else{$checks.token='FAIL'}}
 } finally {$process.Dispose()}
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
