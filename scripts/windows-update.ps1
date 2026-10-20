#requires -Version 5.1
param(
 [string]$Root = 'C:\ProgramData\MathUniverse',
 [string]$Branch = 'feat/math-universe-foundation',
 [switch]$Install,
 [switch]$CheckOnly
)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'windows-deployment.ps1')
$Root=[IO.Path]::GetFullPath($Root)
$repo='YehorBabenko88/math'
$origin="https://github.com/$repo.git"
$gitDir=Join-Path $Root 'repository'
$releases=Join-Path $Root 'releases'
$active=Join-Path $Root 'active.txt'
$service='MathUniverse'
$node=(Get-Command node -ErrorAction Stop).Source
$git=(Get-Command git -ErrorAction Stop).Source
$headers=@{Accept='application/vnd.github+json';'User-Agent'='MathUniverse-Updater';'X-GitHub-Api-Version'='2022-11-28'}
function Get-GitHubPages([string]$Path,[string]$Property) {
 $items=@()
 for($page=1;$page -le 10;$page++){
  $separator=if($Path.Contains('?')){'&'}else{'?'}
  $response=Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/$Path${separator}per_page=100&page=$page" -Headers $headers -TimeoutSec 20
  $batch=@($response.$Property)
  if(!$response.PSObject.Properties[$Property]){throw 'Invalid GitHub response'}
  $items+=$batch
  if($batch.Count -lt 100){return $items}
 }
 throw 'GitHub evidence exceeds bounded pagination; refusing incomplete evidence'
}
function Assert-CandidateChecks([string]$Sha) {
 $runs=Get-GitHubPages "actions/runs?head_sha=$Sha" 'workflow_runs'
 $jobEvidence=@{}
 Assert-DeploymentChecks -Sha $Sha -Branch $Branch -Runs $runs -GetJobs {
  param($run)
  $jobs=Get-GitHubPages "actions/runs/$($run.id)/attempts/$($run.run_attempt)/jobs" 'jobs'
  $current=Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/actions/runs/$($run.id)" -Headers $headers -TimeoutSec 20
  if($current.head_sha -cne $Sha -or $current.run_attempt -ne $run.run_attempt -or $current.status -cne 'completed' -or $current.conclusion -cne 'success'){throw 'Workflow changed during verification'}
  $jobEvidence["$($run.id):$($run.run_attempt)"]=$jobs
  $jobs
 }
 # Refresh newest-run selection after gathering jobs; never reuse evidence for a new run/attempt.
 $latest=Get-GitHubPages "actions/runs?head_sha=$Sha" 'workflow_runs'
 Assert-DeploymentChecks -Sha $Sha -Branch $Branch -Runs $latest -GetJobs {
  param($run)
  $key="$($run.id):$($run.run_attempt)"
  if(!$jobEvidence.ContainsKey($key)){throw 'Workflow selection changed during verification'}
  $jobEvidence[$key]
 }
}
New-Item -ItemType Directory -Force $Root | Out-Null
$deploymentLock=Enter-DeploymentLock -Root $Root
try {
New-Item -ItemType Directory -Force $releases | Out-Null
if(!(Test-Path -LiteralPath (Join-Path $gitDir '.git'))){
 & $git clone --no-checkout $origin $gitDir
 if($LASTEXITCODE -ne 0){throw 'Clone failed'}
}
Push-Location -LiteralPath $gitDir
try {
 & $git fetch --prune origin "+refs/heads/$($Branch):refs/remotes/origin/$($Branch)"
 if($LASTEXITCODE -ne 0){throw 'Fetch failed'}
 $sha=(& $git rev-parse "refs/remotes/origin/$Branch").Trim()
 if($LASTEXITCODE -ne 0 -or $sha -cnotmatch '^[a-f0-9]{40}$'){throw 'Invalid commit SHA'}
 Assert-CandidateChecks $sha
 $old=if(Test-Path -LiteralPath $active){(Get-Content -LiteralPath $active -Raw).Trim()}else{''}
 if($old -and $old -cnotmatch '^[a-f0-9]{40}$'){throw 'Invalid previous release pointer'}
 if($old -eq $sha){Write-Output "Already current: $sha";exit 0}
 if($CheckOnly){Write-Output "Verified candidate: $sha";exit 0}
 $nssm=(Get-Command nssm -ErrorAction Stop).Source
 $target=Join-Path $releases $sha
 if(!(Test-Path -LiteralPath $target)){
  & $git worktree add --detach $target $sha
  if($LASTEXITCODE -ne 0){throw 'Worktree creation failed'}
 }
 Assert-DeploymentRelease -Repository $gitDir -Target $target -Sha $sha -Git $git
 Push-Location -LiteralPath $target
 try {
  # Fail closed without disposable test DB + PDF runtime and reject every skip/todo.
  & $node 'scripts/test-full-ci.mjs'
  if($LASTEXITCODE -ne 0){throw 'Candidate full tests failed'}
 }finally{Pop-Location}
 if($Install){
  $launcher=Join-Path $Root 'launch.ps1'
  Set-Content -LiteralPath $launcher -Value (Get-DeploymentLauncher) -Encoding UTF8
  & $nssm install $service 'powershell.exe' "-NoProfile -NonInteractive -File `"$launcher`""
  if($LASTEXITCODE -ne 0){throw 'NSSM install failed'}
  & $nssm set $service Start SERVICE_AUTO_START | Out-Null
  if($LASTEXITCODE -ne 0){throw 'NSSM configuration failed'}
 }
 if(!(Get-Service $service -ErrorAction SilentlyContinue)){throw 'Service missing; run -Install as administrator'}
 # Local testing and installation may take minutes. Require fresh evidence before activation.
 Assert-CandidateChecks $sha
 Invoke-DeploymentActivation -Sha $sha -Old $old -WritePointer {
  param($value)
  if($value -ceq $sha){Assert-DeploymentRelease -Repository $gitDir -Target $target -Sha $sha -Git $git}
  # Same-volume atomic replacement: a failed write never truncates the known-good pointer.
  Write-DeploymentPointer -Path $active -Sha $value
 } -RemovePointer {Remove-Item -LiteralPath $active -ErrorAction Stop} -Restart {
  & $nssm restart $service | Out-Null
  if($LASTEXITCODE -ne 0){throw 'NSSM restart failed'}
 } -Stop {
  & $nssm stop $service | Out-Null
  if($LASTEXITCODE -ne 0){throw 'NSSM stop failed'}
 } -Healthy {
  for($i=0;$i -lt 20;$i++){
   Start-Sleep -Seconds 1
   try{$response=Invoke-RestMethod 'http://127.0.0.1:8787/healthz' -TimeoutSec 2;if($response.status -eq 'ok'){return $true}}catch{}
  }
  return $false
 }
 Write-Output "Activated $sha"
}finally{Pop-Location}
}finally{$deploymentLock.Dispose()}
