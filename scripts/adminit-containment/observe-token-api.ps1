# One future explicitly approved current-process observation, never G1 admission.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
try {
 . (Join-Path $PSScriptRoot 'g0-token-api.ps1')
 Get-G0StructuredTokenObservation | ConvertTo-Json -Depth 4 -Compress
 exit 2
} catch {
 [Console]::Error.WriteLine('G0_TOKEN_ADAPTER_BLOCKED')
 exit 2
}
