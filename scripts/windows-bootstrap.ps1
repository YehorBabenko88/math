#requires -Version 5.1
<#
.SYNOPSIS
  Bootstrap prerequisites for a standalone Math Universe Windows pilot.
.DESCRIPTION
  Opt-in install of Git, Node.js LTS and NSSM via winget, with post-install checks.
  Does not install PostgreSQL, deploy releases, or enable unattended updates.
#>
[CmdletBinding()]
param([switch]$InstallService,[switch]$AcceptPackages)
$ErrorActionPreference='Stop'
if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
 throw 'Run PowerShell as Administrator.'
}
function Refresh-Path {
 $env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
}
function Has-Command([string]$name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
function Node-Ready {
 if(-not (Has-Command 'node.exe')){return $false}
 try {$v=(& node.exe -p 'process.versions.node').Trim();$major=[int]($v.Split('.')[0]);return ($major -eq 22 -or $major -eq 24)}catch{return $false}
}
$missing=@()
if(-not (Has-Command 'git.exe')){$missing+=@{id='Git.Git';name='Git'}}
if(-not (Node-Ready)){$missing+=@{id='OpenJS.NodeJS.LTS';name='Node.js LTS'}}
if(-not (Has-Command 'nssm.exe')){$missing+=@{id='NSSM.NSSM';name='NSSM'}}
if($missing.Count -gt 0 -and -not $AcceptPackages){
 Write-Host 'Required packages:'
 $missing|ForEach-Object {Write-Host (' - '+$_.name+' ('+$_.id+')')}
 throw 'Review package list and rerun with -AcceptPackages to allow winget installation.'
}
if($missing.Count -gt 0 -and -not (Has-Command 'winget.exe')){
 throw 'Windows Package Manager (winget) unavailable. Install App Installer from Microsoft and retry.'
}
foreach($pkg in $missing){
 Write-Host ('Installing '+$pkg.name+' via winget...')
 & winget.exe install --exact --id $pkg.id --source winget --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
 if($LASTEXITCODE -ne 0){throw ('Package installation failed: '+$pkg.id+' exit '+$LASTEXITCODE)}
 Refresh-Path
}
Refresh-Path
if(-not (Has-Command 'git.exe')){throw 'Git is still missing after installation.'}
if(-not (Node-Ready)){throw 'Node.js version is missing or unsupported (requires major 22 or 24).'}
if(-not (Has-Command 'nssm.exe')){throw 'NSSM is still missing after installation.'}
Write-Host ('Git: '+(& git.exe --version))
Write-Host ('Node: '+(& node.exe --version))
Write-Host ('NSSM: '+(& nssm.exe version | Select-Object -First 1))
Write-Host ('PostgreSQL command detected: '+[bool](Has-Command 'psql.exe')+' (not required for current pilot)')
if($InstallService){
 $repo='https://github.com/YehorBabenko88/math.git'
 $source='C:\ProgramData\MathUniverse\bootstrap-source'
 if(-not (Test-Path (Join-Path $source '.git'))){
  & git.exe clone --branch feat/math-universe-foundation --single-branch $repo $source
  if($LASTEXITCODE -ne 0){throw 'Bootstrap clone failed'}
 }else{
  Write-Host 'Existing bootstrap source found; not overwriting it.'
 }
 & (Join-Path $source 'scripts\windows-update.ps1') -Install
 if($LASTEXITCODE -and $LASTEXITCODE -ne 0){throw 'Service installer failed'}
}
Write-Host 'Prerequisite bootstrap completed. Automatic background updates remain disabled.'
