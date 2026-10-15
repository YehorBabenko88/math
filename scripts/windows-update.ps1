param(
 [string]$Root = 'C:\ProgramData\MathUniverse',
 [string]$Branch = 'feat/math-universe-foundation',
 [switch]$Install,
 [switch]$CheckOnly
)
$ErrorActionPreference='Stop'
$repo='YehorBabenko88/math'
$origin="https://github.com/$repo.git"
$gitDir=Join-Path $Root 'repository'
$releases=Join-Path $Root 'releases'
$active=Join-Path $Root 'active.txt'
$service='MathUniverse'
$node=(Get-Command node -ErrorAction Stop).Source
$git=(Get-Command git -ErrorAction Stop).Source
$nssm=(Get-Command nssm -ErrorAction Stop).Source
New-Item -ItemType Directory -Force $Root,$releases | Out-Null
if(!(Test-Path (Join-Path $gitDir '.git'))){
 & $git clone --no-checkout $origin $gitDir
 if($LASTEXITCODE -ne 0){throw 'Clone failed'}
}
Push-Location $gitDir
try {
 & $git fetch --prune origin "+refs/heads/$($Branch):refs/remotes/origin/$($Branch)"
 if($LASTEXITCODE -ne 0){throw 'Fetch failed'}
 $sha=(& $git rev-parse "refs/remotes/origin/$Branch").Trim()
 if($sha -notmatch '^[a-f0-9]{40}$'){throw 'Invalid commit SHA'}
 $url="https://api.github.com/repos/$repo/actions/runs?head_sha=$sha&per_page=100"
 $runs=(Invoke-RestMethod -Uri $url -Headers @{Accept='application/vnd.github+json';'User-Agent'='MathUniverse-Updater'} -TimeoutSec 20).workflow_runs
 foreach($name in @('Validate Math Universe','Browser E2E')){
  $matching=@($runs | Where-Object {$_.name -eq $name -and $_.head_sha -eq $sha})
  if(!$matching.Count -or !(@($matching | Where-Object {$_.status -eq 'completed' -and $_.conclusion -eq 'success'}).Count)){throw "Missing green CI: $name"}
 }
 $old=if(Test-Path $active){(Get-Content $active -Raw).Trim()}else{''}
 if($old -eq $sha){Write-Output "Already current: $sha";exit 0}
 if($CheckOnly){Write-Output "Verified candidate: $sha";exit 0}
 $target=Join-Path $releases $sha
 if(!(Test-Path $target)){
  & $git worktree add --detach $target $sha
  if($LASTEXITCODE -ne 0){throw 'Worktree creation failed'}
 }
 Push-Location $target
 try {
  & $node --test (Get-ChildItem 'tests\*.test.mjs' | ForEach-Object FullName)
  if($LASTEXITCODE -ne 0){throw 'Candidate tests failed'}
 }finally{Pop-Location}
 if($Install){
  if(!(Test-Path $active)){Set-Content -Path $active -Value $sha -NoNewline}
  $launcher=Join-Path $Root 'launch.ps1'
  $launchContent=@'
$ErrorActionPreference='Stop'
$root='C:\ProgramData\MathUniverse'
$sha=(Get-Content (Join-Path $root 'active.txt') -Raw).Trim()
if($sha -notmatch '^[a-f0-9]{40}$'){throw 'Invalid active release'}
Set-Location (Join-Path (Join-Path $root 'releases') $sha)
& node 'src/local-server.mjs'
'@
  Set-Content -Path $launcher -Value $launchContent -Encoding UTF8
  & $nssm install $service 'powershell.exe' "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$launcher`""
  if($LASTEXITCODE -ne 0){throw 'NSSM install failed'}
  & $nssm set $service Start SERVICE_AUTO_START | Out-Null
 }
 if(!(Get-Service $service -ErrorAction SilentlyContinue)){throw 'Service missing; run -Install as administrator'}
 Set-Content -Path $active -Value $sha -NoNewline
 try {
  & $nssm restart $service | Out-Null
  $healthy=$false
  for($i=0;$i -lt 20;$i++){
   Start-Sleep -Seconds 1
   try{$response=Invoke-RestMethod 'http://127.0.0.1:8787/healthz' -TimeoutSec 2;if($response.status -eq 'ok'){$healthy=$true;break}}catch{}
  }
  if(!$healthy){throw 'Health check failed'}
  Write-Output "Activated $sha"
 }catch{
  if($old -match '^[a-f0-9]{40}
 }
}finally{Pop-Location}
){
   Set-Content -Path $active -Value $old -NoNewline
   & $nssm restart $service | Out-Null
  }else{
   Remove-Item -Path $active -ErrorAction SilentlyContinue
   & $nssm stop $service | Out-Null
  }
  throw
 }
}finally{Pop-Location}
