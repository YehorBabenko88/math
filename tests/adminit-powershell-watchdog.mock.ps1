$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$text=[IO.File]::ReadAllText((Join-Path $root '.github/workflows/adminit-synthetic-containment.yml'))
$match=[regex]::Match($text,'if \(-not \$owner\.WaitForExit\(150000\)\) \{\r?\n(?<body>[\s\S]*?)\r?\n {12}\}')
if(-not $match.Success){throw 'Watchdog timeout branch missing'}
$body=[scriptblock]::Create($match.Groups['body'].Value)
$cases=@(
 @{wait=$false;exited=$false;killFails=$false;expected='cleanup unconfirmed'},
 @{wait=$true;exited=$false;killFails=$false;expected='cleanup unconfirmed'},
 @{wait=$true;exited=$true;killFails=$false;expected='watchdog expired: BLOCKED, never PASS'},
 @{wait=$false;exited=$false;killFails=$true;expected='kill failed: BLOCKED'}
)
$failed=0
foreach($case in $cases){
 $owner=[pscustomobject]@{HasExited=$case.exited;waitResult=$case.wait;killFails=$case.killFails;killCalls=0;waitCalls=0}
 $owner|Add-Member -MemberType ScriptMethod -Name Kill -Value {$this.killCalls++;if($this.killFails){throw 'mock kill failure'}}
 $owner|Add-Member -MemberType ScriptMethod -Name WaitForExit -Value {param($milliseconds) if($milliseconds -ne 5000){throw 'unexpected mock deadline'};$this.waitCalls++;return $this.waitResult}
 $reason=$null
 try{& $body}catch{$reason=$_.Exception.Message}
 if($null -eq $reason -or -not $reason.Contains($case.expected) -or $owner.killCalls -ne 1){$failed++}
}
if($failed -ne 0){throw 'Mock watchdog failed to distinguish confirmed/unconfirmed root cleanup'}
Write-Output 'PASS: four PowerShell watchdog timeout paths; fake owner only; descendant status never inferred'
