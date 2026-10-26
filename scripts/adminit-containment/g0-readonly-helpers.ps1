# Pure parsing/path helpers. No machine, file, network, process or policy queries.
function Get-G0TokenObservation([string]$Csv,[bool]$AdminRoleEnabled) {
 if($AdminRoleEnabled){return 'FAIL'}
 if([string]::IsNullOrWhiteSpace($Csv) -or $Csv.Length -gt 65536){return 'UNKNOWN'}
 $lines=@($Csv -split '\r?\n'|Where-Object {$_.Length -gt 0})
 if($lines.Count -gt 1024){return 'UNKNOWN'}
 $labels=New-Object 'System.Collections.Generic.List[string]'
 foreach($line in $lines) {
  if($line -cnotmatch '^"(?:[^"]|"")*","(?:[^"]|"")*","(?:[^"]|"")*","(?:[^"]|"")*"$'){return 'UNKNOWN'}
  try {$row=$line|ConvertFrom-Csv -Header Name,Type,Sid,Attributes -WarningAction Stop -ErrorAction Stop} catch {return 'UNKNOWN'}
  if($row.Sid -cmatch '^S-1-16-[0-9]+$'){$labels.Add($row.Sid)}
 }
 if($labels.Count -ne 1){return 'UNKNOWN'}
 if($labels[0] -ceq 'S-1-16-8192'){return 'PASS'}
 return 'FAIL'
}
function Get-G0AclInspectionPaths([string]$Root,[string]$Source) {
 $rootPath=[IO.Path]::GetFullPath($Root).TrimEnd('\')
 $sourcePath=[IO.Path]::GetFullPath($Source)
 if(-not $sourcePath.StartsWith($rootPath+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'G0 scope BLOCKED'}
 $current=$rootPath
 $current
 foreach($part in $sourcePath.Substring($rootPath.Length+1).Split('\')) {if($part){$current=Join-Path $current $part;$current}}
}
