param([Parameter(Mandatory=$true)][string]$SourceCheckout)
$ErrorActionPreference='Stop'
# Read-only collection, not permission to run a native fixture or proof of isolation.
$root=[IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MathUniverseAdminitAcceptance'))
$checkout=[IO.Path]::GetFullPath($SourceCheckout)
if($checkout -cne $SourceCheckout -or -not $checkout.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Only new acceptance-root checkout may be inspected: BLOCKED'}
if($root.StartsWith('\\')){throw 'Local acceptance root required: BLOCKED'}
function Assert-ExistingAncestors([string]$LiteralPath){
 $drive=[IO.Path]::GetPathRoot($LiteralPath);$current=$drive
 foreach($part in $LiteralPath.Substring($drive.Length).Split('\')){
  $current=Join-Path $current $part
  try{$entry=Get-Item -LiteralPath $current -Force -ErrorAction Stop}
  catch [System.Management.Automation.ItemNotFoundException]{break}
  if($entry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse ancestor BLOCKED before descendant inspection'}
 }
}
Assert-ExistingAncestors $root
Assert-ExistingAncestors $checkout
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$principal=New-Object Security.Principal.WindowsPrincipal($identity)
$sid=$identity.User.Value
$groups=@($identity.Groups | ForEach-Object { $_.Value })
$integrity=@($groups | Where-Object { $_ -match '^S-1-16-[0-9]+$' })
$rid=$null
if($integrity.Count -eq 1){$rid=[int]($integrity[0].Substring(7))}
$source=@{head=$null;tree=$null}
$exists=Test-Path -LiteralPath $root -PathType Container
$ownerMatches=$null;$writers=$null
if($exists){
 $item=Get-Item -LiteralPath $root -Force
 if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'New root reparse point BLOCKED'}
 $acl=Get-Acl -LiteralPath $root
 $ownerMatches=$acl.Owner -eq $identity.Name -or $acl.Owner -eq $sid
 $writers=0;$allowed=@($sid,'S-1-5-18','S-1-5-32-544')
 foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
  $write=2 -bor 4 -bor 16 -bor 64 -bor 256 -bor 65536 -bor 262144 -bor 524288
  if($rule.AccessControlType -eq 'Allow' -and ($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -eq 0 -and ($rule.FileSystemRights -band $write) -ne 0 -and $allowed -notcontains $rule.IdentityReference.Value){$writers++}
 }
}
# Source identity deliberately UNKNOWN: inherited Git context/metadata may escape
# the root or write traces. A separate qualified source verifier is required.
$network=@{inventoryComplete=$false;activeNonloopbackCount=$null}
try{
 $interfaces=@([Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces())
 $active=@($interfaces | Where-Object { $_.NetworkInterfaceType -ne [Net.NetworkInformation.NetworkInterfaceType]::Loopback -and $_.OperationalStatus -eq [Net.NetworkInformation.OperationalStatus]::Up })
 $network.inventoryComplete=$true;$network.activeNonloopbackCount=$active.Count
}catch{ }
$observation=@{schema='math.adminit.readonly-snapshot.v1';observedAt=[DateTime]::UtcNow.ToString('o');machineName=[Environment]::MachineName;userSid=$sid;source=$source;session=@{powerShellVersion=$PSVersionTable.PSVersion.ToString();edition=$PSVersionTable.PSEdition;adminRoleEnabled=$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator);integrityRid=$rid;administratorsGroupPresent=($groups -contains 'S-1-5-32-544');currentUserPolicy=(Get-ExecutionPolicy -Scope CurrentUser).ToString();effectivePolicy=(Get-ExecutionPolicy).ToString()};laboratory=@{scope='SEPARATE_NEW_ROOT';exists=$exists;ownerMatches=$ownerMatches;untrustedWriterCount=$writers};network=$network;provenance='UNATTESTED_LOCAL_COLLECTION'}
$observation | ConvertTo-Json -Depth 6
