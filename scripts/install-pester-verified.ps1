param([Parameter(Mandatory=$true)][string]$Destination,[string]$ArchivePath,[switch]$VerifyOnly)
$ErrorActionPreference='Stop'
# Point-in-time integrity only: concurrent same-user writes require isolation.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$downloaded=$false
function Get-PesterFileDigest([string]$Path) {
 # Avoid PowerShell-edition-dependent module autoload for Get-FileHash.
 $stream=[IO.File]::OpenRead($Path)
 $sha=[Security.Cryptography.SHA256]::Create()
 try { return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','') }
 finally { $stream.Dispose(); $sha.Dispose() }
}
function Assert-NoReparse([string]$Path) {
 $current=[IO.Path]::GetFullPath($Path)
 while($current){
  if(Test-Path -LiteralPath $current){
   if((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Reparse path refused: $current"}
  }
  $parent=Split-Path -Path $current -Parent
  if($parent -eq $current){break}; $current=$parent
 }
}
try {
 if(-not $ArchivePath){
  $ArchivePath=Join-Path ([IO.Path]::GetTempPath()) ('pester-'+[guid]::NewGuid()+'.zip')
  $downloaded=$true
  Invoke-WebRequest 'https://www.powershellgallery.com/api/v2/package/Pester/4.10.1' -OutFile $ArchivePath
 }
 if((Get-PesterFileDigest $ArchivePath) -cne '898210E1A30C52CD46BA317C2278A9324345214213AA2F7D6B7DFA7B98F37AC9'){throw 'Pester archive digest mismatch'}
 $Destination=[IO.Path]::GetFullPath($Destination)
 Assert-NoReparse $Destination
 $module=Join-Path $Destination 'Pester/4.10.1'
 if(-not $VerifyOnly){
  if(Test-Path -LiteralPath $Destination){throw 'Pester destination already exists'}
  New-Item -ItemType Directory -Path $module | Out-Null
  Expand-Archive -LiteralPath $ArchivePath -DestinationPath $module
 }
 if(-not (Test-Path -LiteralPath $module -PathType Container)){throw 'Pester installation missing'}
 $expected=@{}
 $directories=@{'Pester'=$true;'Pester/4.10.1'=$true}
 $zip=[IO.Compression.ZipFile]::OpenRead($ArchivePath)
 try {
  foreach($entry in $zip.Entries){
   $relative=$entry.FullName.Replace('\','/').TrimEnd('/')
   if(-not $relative -or $relative.StartsWith('/') -or $relative -match '(^|/)\.{1,2}(/|$)' -or $relative.Contains(':')){throw 'Unsafe archive entry'}
   $key='Pester/4.10.1/'+$relative
   $parent=$key
   if(-not $entry.FullName.EndsWith('/')){
    if($expected.ContainsKey($key)){throw 'Duplicate archive file'}
    $stream=$entry.Open(); $sha=[Security.Cryptography.SHA256]::Create()
    try {$expected[$key]=[BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','')} finally {$stream.Dispose();$sha.Dispose()}
    $parent=$key.Substring(0,$key.LastIndexOf('/'))
   }
   while($parent){$directories[$parent]=$true;$slash=$parent.LastIndexOf('/');if($slash -lt 0){break};$parent=$parent.Substring(0,$slash)}
  }
 } finally {$zip.Dispose()}
 $seenFiles=@{}; $seenDirectories=@{}
 # Inspect each entry before traversal; never follow a reparse directory.
 $pending=New-Object 'System.Collections.Generic.Queue[string]'
 $pending.Enqueue($Destination)
 while($pending.Count){
  $directory=$pending.Dequeue()
  foreach($item in Get-ChildItem -LiteralPath $directory -Force){
   if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Reparse installation entry: $($item.FullName)"}
   $key=$item.FullName.Substring($Destination.TrimEnd('\','/').Length+1).Replace('\','/')
   if($item.PSIsContainer){
    if(-not $directories.ContainsKey($key)){throw "Unexpected Pester directory: $key"}
    $seenDirectories[$key]=$true; $pending.Enqueue($item.FullName)
   } else {
    if(-not $expected.ContainsKey($key)){throw "Unexpected Pester file: $key"}
    if((Get-PesterFileDigest $item.FullName) -cne $expected[$key]){throw "Pester file digest mismatch: $key"}
    $seenFiles[$key]=$true
   }
  }
 }
 if($seenFiles.Count -ne $expected.Count -or $seenDirectories.Count -ne $directories.Count){throw 'Pester installation composition mismatch'}
 Write-Output 'Verified complete Pester 4.10.1 installation'
} finally {
 if($downloaded -and (Test-Path -LiteralPath $ArchivePath)){Remove-Item -LiteralPath $ArchivePath}
}
