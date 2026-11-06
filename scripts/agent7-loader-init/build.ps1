param([Parameter(Mandatory=$true)][string]$OutputRoot,[Parameter(Mandatory=$true)][string]$ExpectedHead,[Parameter(Mandatory=$true)][string]$ExpectedTree)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if($PSVersionTable.PSEdition -ne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5){throw 'HOSTED_TRACE_BLOCKED'}
if($env:GITHUB_ACTIONS -cne 'true' -or $env:RUNNER_ENVIRONMENT -cne 'github-hosted' -or $env:RUNNER_OS -cne 'Windows' -or $env:GITHUB_REPOSITORY -cne 'YehorBabenko88/math' -or $env:GITHUB_RUN_ID -cnotmatch '^[1-9][0-9]{0,18}$' -or $env:GITHUB_RUN_ATTEMPT -cnotmatch '^[1-9][0-9]{0,18}$'){throw 'HOSTED_TRACE_BLOCKED'}
$machine=[Environment]::MachineName.Replace('-','').Replace('_','').ToUpperInvariant()
if($machine -in @('ADMINIT','AMINIT','LS5','LS7','PC1','PC2','PC3','PC4','EASY','LEITSTELLE1','LS03E','LS4','LS07')){throw 'OFFICE_TRACE_BLOCKED'}
if($ExpectedHead -cnotmatch '^[a-f0-9]{40}$' -or $ExpectedTree -cnotmatch '^[a-f0-9]{40}$' -or $env:NODE_OPTIONS -or $env:NODE_PATH){throw 'HOSTED_TRACE_BLOCKED'}
$checkout=git --no-replace-objects rev-parse --show-toplevel
if($LASTEXITCODE -ne 0 -or -not [String]::Equals([IO.Path]::GetFullPath($PSScriptRoot),[IO.Path]::GetFullPath((Join-Path $checkout 'scripts/agent7-loader-init')),[StringComparison]::OrdinalIgnoreCase)){throw 'SOURCE_TRACE_BLOCKED'}
$head=git --no-replace-objects rev-parse HEAD
if($LASTEXITCODE -ne 0 -or $head -cne $ExpectedHead){throw 'SOURCE_TRACE_BLOCKED'}
$tree=git --no-replace-objects rev-parse 'HEAD^{tree}'
if($LASTEXITCODE -ne 0 -or $tree -cne $ExpectedTree){throw 'SOURCE_TRACE_BLOCKED'}
$verify='const {pathToFileURL}=await import(''node:url'');const {verifySourceIdentity}=await import(pathToFileURL(process.argv[1]).href);console.log(verifySourceIdentity(process.argv[2]).trackedSourceSha256);'
$validator=Join-Path $checkout 'scripts/verify-source-identity.mjs'
$before=& node --input-type=module -e $verify $validator $ExpectedHead
if($LASTEXITCODE -ne 0 -or $before -cnotmatch '^[a-f0-9]{64}$'){throw 'SOURCE_TRACE_BLOCKED'}
# Reuse original unmodified builder/package/pins. It runs MODEL tests only.
& (Join-Path $checkout 'scripts/adminit-containment/build-hosted.ps1') -OutputRoot $OutputRoot -ExpectedHead $ExpectedHead
if($LASTEXITCODE -ne 0){throw 'BUILD_TRACE_BLOCKED'}
function Read-Committed([string]$InputPath){
 $script='const {execFileSync}=require(''node:child_process'');process.stdout.write(execFileSync(''git'',[''--no-replace-objects'',''show'',process.argv[1]+'':''+process.argv[2]]).toString(''base64''));'
 $encoded=& node -e $script $ExpectedHead $InputPath
 if($LASTEXITCODE -ne 0){throw 'SOURCE_TRACE_BLOCKED'}
 return (New-Object Text.UTF8Encoding($false,$true)).GetString([Convert]::FromBase64String($encoded))
}
$source=(Read-Committed 'scripts/q01-lab/WindowsJobContainment.cs')+[char]10+(Read-Committed 'tests/fixtures/adminit-containment/HostedPrivateDesktop.cs')+[char]10+(Read-Committed 'tests/fixtures/agent7-loader-init/HostedLoaderInitTrace.cs')
$exe=Join-Path $OutputRoot 'HostedLoaderInitTrace.exe'
$parameters=New-Object CodeDom.Compiler.CompilerParameters
$parameters.GenerateExecutable=$true
$parameters.OutputAssembly=$exe
$parameters.CompilerOptions='/platform:x64'
$parameters.ReferencedAssemblies.Add('System.dll')|Out-Null
$parameters.ReferencedAssemblies.Add('System.Core.dll')|Out-Null
Add-Type -TypeDefinition $source -CompilerParameters $parameters
$after=& node --input-type=module -e $verify $validator $ExpectedHead
if($LASTEXITCODE -ne 0 -or $after -cne $before){throw 'SOURCE_TRACE_BLOCKED'}
$identity=@{head=$head;tree=$tree;sha256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant();trackedSourceSha256=$before;qualification='NONE';nativeAcceptance='BLOCKED'}
[IO.File]::WriteAllText((Join-Path $OutputRoot 'loader-init-identity.json'),($identity|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
Write-Output 'TRACE_COMPILED qualification=NONE nativeAcceptance=BLOCKED'
