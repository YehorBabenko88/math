$ErrorActionPreference='Stop'
$gate=Join-Path $PSScriptRoot '../scripts/adminit-containment/verify-adminit.ps1'
$reason=$null
try { & $gate -PackageRoot 'C:\fixture-not-read' -ExpectedManifestSha256 ('a'*64) -ExpectedSourceHead ('b'*40) -Execute }
catch { $reason=$_.Exception.Message }
if($reason -notlike '*ADMINIT isolation criteria not integrated: BLOCKED*'){throw 'local Execute did not fail closed before filesystem/native checks'}
foreach($name in @('verify-adminit.ps1','build-hosted.ps1')){
 $errors=$null;$tokens=$null
 [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot ('../scripts/adminit-containment/'+$name)),[ref]$tokens,[ref]$errors)|Out-Null
 if($errors.Count -ne 0){throw 'PowerShell parser errors'}
}
Write-Output 'PASS: local Execute blocked before native/filesystem effects; scripts parse; no native fixture invoked'
