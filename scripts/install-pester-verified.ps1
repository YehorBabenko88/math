param([string]$Destination)
$ErrorActionPreference='Stop'
$archive=Join-Path $env:RUNNER_TEMP ('pester-'+[guid]::NewGuid()+'.zip')
try {
 Invoke-WebRequest 'https://www.powershellgallery.com/api/v2/package/Pester/4.10.1' -OutFile $archive
 if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -cne '898210E1A30C52CD46BA317C2278A9324345214213AA2F7D6B7DFA7B98F37AC9'){throw 'Pester archive digest mismatch'}
 $module=Join-Path $Destination 'Pester/4.10.1'
 New-Item -ItemType Directory -Path $module -Force | Out-Null
 Expand-Archive -LiteralPath $archive -DestinationPath $module
} finally {if(Test-Path -LiteralPath $archive){Remove-Item -LiteralPath $archive}}
