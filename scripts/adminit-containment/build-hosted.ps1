param([Parameter(Mandatory=$true)][string]$OutputRoot,[Parameter(Mandatory=$true)][string]$ExpectedHead)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSEdition -ne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5){throw 'Windows PowerShell5.1 compiler required: BLOCKED'}
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted'){throw 'Disposable hosted build only: BLOCKED'}
if($env:NODE_OPTIONS -or $env:NODE_PATH){throw 'Node preloader BLOCKED'}
$root=[IO.Path]::GetFullPath($OutputRoot)
$temp=[IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\')+'\'
if(-not $root.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $root)){throw 'Fresh hosted output required: BLOCKED'}
$head=git --no-replace-objects rev-parse HEAD
if($LASTEXITCODE -ne 0 -or $head -cne $ExpectedHead){throw 'Source HEAD mismatch: BLOCKED'}
$tree=git --no-replace-objects rev-parse 'HEAD^{tree}'
if($LASTEXITCODE -ne 0){throw 'Source tree unavailable'}
& node (Join-Path $PSScriptRoot 'verify-build-inputs.mjs') $ExpectedHead
if($LASTEXITCODE -ne 0){throw 'Uncommitted build input BLOCKED'}
$validator=Join-Path $PSScriptRoot '../verify-source-identity.mjs'
$verify='const {pathToFileURL}=await import(''node:url'');const {verifySourceIdentity}=await import(pathToFileURL(process.argv[2]).href);console.log(verifySourceIdentity(process.argv[3]).trackedSourceSha256);'
$before=& node --input-type=module -e $verify source-kit-check $validator $ExpectedHead
if($LASTEXITCODE -ne 0 -or $before -cnotmatch '^[a-f0-9]{64}$'){throw 'Tracked source identity BLOCKED'}
New-Item -ItemType Directory -Path (Join-Path $root 'package') | Out-Null
$helper=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../q01-lab/WindowsJobContainment.cs'))
$fixture=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../../tests/fixtures/adminit-containment/AdminitSynthetic.cs'))
$bootstrap=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../../tests/fixtures/adminit-containment/HostedMediumLauncher.cs'))
Add-Type -TypeDefinition ($helper+"`n"+$fixture) -OutputAssembly (Join-Path $root 'package/AdminitSyntheticHarness.exe') -OutputType ConsoleApplication -ReferencedAssemblies System.dll,System.Core.dll,System.Web.Extensions.dll
Add-Type -TypeDefinition ($helper+"`n"+$bootstrap) -OutputAssembly (Join-Path $root 'HostedMediumLauncher.exe') -OutputType ConsoleApplication -ReferencedAssemblies System.dll,System.Core.dll,System.Web.Extensions.dll
$exe=Join-Path $root 'package/AdminitSyntheticHarness.exe'
$manifest=@{schema=1;sourceHead=$head;sourceTree=$tree;localExecution='BLOCKED_PENDING_ISOLATION_REVIEW';files=@(@{path='AdminitSyntheticHarness.exe';bytes=(Get-Item -LiteralPath $exe).Length;sha256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant()})}
# No bootstrap ships in the ADMINIT package. Exact two-file package inventory.
[IO.File]::WriteAllText((Join-Path $root 'package/package.json'),($manifest | ConvertTo-Json -Depth 6))
$after=& node --input-type=module -e $verify source-kit-check $validator $ExpectedHead
if($LASTEXITCODE -ne 0 -or $after -cne $before){throw 'Source changed during build: BLOCKED'}
[IO.File]::WriteAllText((Join-Path $root 'source-identity.json'),(@{sourceHead=$head;sourceTree=$tree;trackedSourceSha256=$before;prePostVerified=$true;frameworkRuntime=[Environment]::Version.ToString();powerShell=$PSVersionTable.PSVersion.ToString();scope='producer report, not independent attestation'} | ConvertTo-Json))
Write-Output ('MANIFEST_SHA256='+(Get-FileHash (Join-Path $root 'package/package.json')).Hash.ToLowerInvariant())
