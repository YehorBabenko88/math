# Definition only. Loading this script performs no token query.
function Get-G0StructuredTokenObservation {
 $unknown=@{schema='math.g0.token-api.v1';scope='CURRENT_PROCESS_OBSERVATION';apiStatus='ERROR';status='UNKNOWN';code='E_LOAD';tokenType='UNKNOWN';integrityRid=$null;elevated=$null;adminEnabled=$null;authority='NONE';isolationConfirmed=$false;localExecute=$false;admission='BLOCKED'}
 try {
  if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){$unknown.code='E_OS';return $unknown}
  # Reject preloaded interop types rather than trusting same-name process state.
  if(('MathUniverse.G0.WindowsTokenAdapter' -as [type]) -or ('MathUniverse.G0.TokenPolicy' -as [type])){return $unknown}
  $path=Join-Path $PSScriptRoot 'WindowsTokenObservation.cs'
  $file=Get-Item -LiteralPath $path -Force -ErrorAction Stop
  if($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $file.Length -gt 65536){return $unknown}
  $null=Add-Type -TypeDefinition ([IO.File]::ReadAllText($path)) -ErrorAction Stop -WarningAction Stop
  $r=[MathUniverse.G0.WindowsTokenAdapter]::Observe()
  # Copy only closed, non-private fields; never return native handles/buffers/errors.
  return @{schema=$r.schema;scope=$r.scope;apiStatus=$r.apiStatus;status=$r.status;code=$r.code;tokenType=$r.tokenType;integrityRid=$r.integrityRid;elevated=$r.elevated;adminEnabled=$r.adminEnabled;authority='NONE';isolationConfirmed=$false;localExecute=$false;admission='BLOCKED'}
 } catch {return $unknown}
}
