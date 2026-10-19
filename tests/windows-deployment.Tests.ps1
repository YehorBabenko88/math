$ErrorActionPreference = 'Stop'
$repository = Split-Path $PSScriptRoot -Parent

# Pester 3's Should Throw assertion is incompatible with PowerShell 7's null conversion.
# Assert a caught exception explicitly so the same fixtures work in PS 5.1 and 7.
function Assert-Throws([scriptblock]$Operation) {
    $caught=$false
    try { & $Operation | Out-Null } catch { $caught=$true }
    $caught | Should Be $true
}

Describe 'Windows script syntax' {
    It 'parses every shipped PowerShell script without executing it' {
        Get-ChildItem (Join-Path $repository 'scripts') -Filter '*.ps1' | ForEach-Object {
            $tokens = $null; $errors = $null
            [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$errors) | Out-Null
            @($errors).Count | Should Be 0
        }
    }
}

Describe 'Windows deployment safety contracts' {
    . (Join-Path $repository 'scripts/windows-deployment.ps1')
    $sha = 'a' * 40
    $branch = 'fix/windows-deployment-safety'
    function New-GreenFixture {
        $runs = @(); $jobs = @{}
        foreach ($workflow in (Get-RequiredDeploymentWorkflows)) {
            $run = [pscustomobject]@{id=$workflow.Id; workflow_id=$workflow.Id; path=$workflow.Path; head_sha=$sha; head_branch=$branch; event='push'; status='completed'; conclusion='success'; run_attempt=1; run_number=1; updated_at='2026-10-19T01:00:00Z'; repository=[pscustomobject]@{full_name='YehorBabenko88/math'}; head_repository=[pscustomobject]@{full_name='YehorBabenko88/math'}}
            $runs += $run
            $jobs[[string]$run.id] = @($workflow.Jobs | ForEach-Object { [pscustomobject]@{name=$_; head_sha=$sha; run_attempt=1; status='completed'; conclusion='success'} })
        }
        return @{Runs=$runs; Jobs=$jobs}
    }
    function Assert-Fixture($fixture) {
        Assert-DeploymentChecks -Sha $sha -Branch $branch -Runs $fixture.Runs -GetJobs { param($run) $fixture.Jobs[[string]$run.id] }
    }
    It 'accepts complete trusted current checks' { Assert-Fixture (New-GreenFixture) }
    It 'accepts actual JSON timestamp representations independently of host culture' {
        $f=New-GreenFixture; $culture=[Threading.Thread]::CurrentThread.CurrentCulture
        try {
            [Threading.Thread]::CurrentThread.CurrentCulture=[Globalization.CultureInfo]::GetCultureInfo('de-DE')
            foreach($run in $f.Runs){$run.updated_at=[DateTime]::Parse('2026-10-19T01:00:00Z',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind)}
            Assert-Fixture $f
        } finally { [Threading.Thread]::CurrentThread.CurrentCulture=$culture }
    }
    It 'requires both Windows contract shells as deployment evidence' {
        $windows=@(Get-RequiredDeploymentWorkflows | Where-Object {$_.Path -eq '.github/workflows/windows-deployment.yml'})
        $windows.Count | Should Be 1
        ($windows[0].Jobs -join ',') | Should Be 'Windows contracts / powershell,Windows contracts / pwsh'
    }
    It 'holds an exclusive per-root updater lock and releases it on disposal' {
        $lock=Enter-DeploymentLock -Root $TestDrive
        try { Assert-Throws { Enter-DeploymentLock -Root $TestDrive } } finally { $lock.Dispose() }
        $next=Enter-DeploymentLock -Root $TestDrive
        $next.Dispose()
    }
    It 'writes and atomically replaces fixture pointers, preserving old bytes on replacement failure' {
        $pointer=Join-Path $TestDrive 'atomic-active.txt'
        Write-DeploymentPointer -Path $pointer -Sha $sha
        (Get-Content -LiteralPath $pointer -Raw) | Should Be $sha
        Write-DeploymentPointer -Path $pointer -Sha ('b'*40)
        (Get-Content -LiteralPath $pointer -Raw) | Should Be ('b'*40)
        $handle=[IO.File]::Open($pointer,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
        try { Assert-Throws { Write-DeploymentPointer -Path $pointer -Sha $sha } } finally { $handle.Dispose() }
        (Get-Content -LiteralPath $pointer -Raw) | Should Be ('b'*40)
        @(Get-ChildItem $TestDrive -Filter '*.active.tmp').Count | Should Be 0
    }
    It 'rejects missing workflows' {
        $f=New-GreenFixture; $f.Runs=$f.Runs[1..3]
        Assert-Throws { Assert-Fixture $f }
    }
    It 'rejects each missing required job including every matrix cell and aggregate' {
        foreach($w in (Get-RequiredDeploymentWorkflows)) {
            foreach($name in $w.Jobs) {
                $f=New-GreenFixture; $f.Jobs[[string]$w.Id]=@($f.Jobs[[string]$w.Id] | Where-Object {$_.name -ne $name})
                Assert-Throws { Assert-Fixture $f }
            }
        }
    }
    It 'rejects failed pending skipped cancelled or wrong SHA checks' {
        foreach($change in @(@{status='queued'},@{status='in_progress'},@{conclusion='failure'},@{conclusion='skipped'},@{conclusion='cancelled'},@{head_sha=('b'*40)},@{run_attempt=0})) {
            $f=New-GreenFixture; $job=$f.Jobs[[string]$f.Runs[0].id][0]
            foreach($key in $change.Keys){$job.$key=$change[$key]}
            Assert-Throws { Assert-Fixture $f }
        }
    }
    It 'rejects spoofed workflow path repo branch event SHA and workflow ID' {
        foreach($change in @(@{path='other.yml'},@{head_branch='other'},@{event='pull_request'},@{head_sha=('b'*40)},@{workflow_id=1},@{repository=[pscustomobject]@{full_name='other/math'}},@{head_repository=[pscustomobject]@{full_name='other/math'}})) {
            $f=New-GreenFixture
            foreach($key in $change.Keys){$f.Runs[0].$key=$change[$key]}
            Assert-Throws { Assert-Fixture $f }
        }
    }
    It 'rejects an older success followed by a failed or pending run' {
        foreach($status in @('completed','queued')) {
            $f=New-GreenFixture; $new=$f.Runs[0].PSObject.Copy(); $new.id=999999999; $new.run_number=2; $new.status=$status; $new.conclusion='failure'; $f.Runs+=@($new)
            Assert-Throws { Assert-Fixture $f }
        }
    }
    It 'rejects a newer failed rerun and stale attempt jobs' {
        $f=New-GreenFixture; $new=$f.Runs[0].PSObject.Copy(); $new.run_attempt=2; $new.conclusion='failure'; $f.Runs+=@($new)
        Assert-Throws { Assert-Fixture $f }
        $new.conclusion='success'
        Assert-Throws { Assert-Fixture $f }
    }
    It 'rejects a newer wrong-branch run rather than falling back to old green' {
        $f=New-GreenFixture; $new=$f.Runs[0].PSObject.Copy(); $new.id=999999999; $new.run_number=2; $new.head_branch='other'; $f.Runs+=@($new)
        Assert-Throws { Assert-Fixture $f }
    }
    It 'rejects an older run rerun after a newer run succeeded' {
        $f=New-GreenFixture; $new=$f.Runs[0].PSObject.Copy(); $new.id=999999999; $new.run_number=2; $f.Jobs[[string]$new.id]=$f.Jobs[[string]$f.Runs[0].id]; $f.Runs+=@($new)
        $f.Runs[0].updated_at='2026-10-19T02:00:00Z'; $f.Runs[0].run_attempt=2; $f.Runs[0].status='queued'; $f.Runs[0].conclusion=$null
        Assert-Throws { Assert-Fixture $f }
    }
    It 'fails closed when failed rerun activity ties a newer run timestamp' {
        $f=New-GreenFixture; $new=$f.Runs[0].PSObject.Copy(); $new.id=999999999; $new.run_number=2; $f.Jobs[[string]$new.id]=$f.Jobs[[string]$f.Runs[0].id]; $f.Runs+=@($new)
        $f.Runs[0].run_attempt=2; $f.Runs[0].status='queued'; $f.Runs[0].conclusion=$null
        Assert-Throws { Assert-Fixture $f }
    }
    It 'rejects missing malformed or zero run metadata' {
        foreach($change in @(@{updated_at=$null},@{updated_at='garbage'},@{id=0},@{run_number=0},@{run_attempt='garbage'})) {
            $f=New-GreenFixture
            foreach($key in $change.Keys){$f.Runs[0].$key=$change[$key]}
            Assert-Throws { Assert-Fixture $f }
        }
    }
    It 'rejects duplicate successful job names and accepts a genuinely newer successful run' {
        $f=New-GreenFixture; $key=[string]$f.Runs[0].id; $f.Jobs[$key]+=@($f.Jobs[$key][0])
        Assert-Throws { Assert-Fixture $f }
        $f=New-GreenFixture; $new=$f.Runs[0].PSObject.Copy(); $new.id=999999999; $new.run_number=2; $new.updated_at='2026-10-19T03:00:00Z'; $f.Jobs[[string]$new.id]=$f.Jobs[[string]$f.Runs[0].id]; $f.Runs[0].conclusion='failure'; $f.Runs+=@($new)
        Assert-Fixture $f
    }
    It 'generates a launcher using its actual custom root including apostrophes and spaces' {
        $root=Join-Path $TestDrive "custom root's [folder]"; New-Item -ItemType Directory $root | Out-Null
        $release=Join-Path (Join-Path $root 'releases') $sha; New-Item -ItemType Directory -Force $release | Out-Null
        Set-Content -LiteralPath (Join-Path $root 'active.txt') $sha
        Set-Content -LiteralPath (Join-Path $root 'launch.ps1') (Get-DeploymentLauncher)
        function node { param($script) $global:LASTEXITCODE=0; (Get-Location).Path; $script }
        $before=(Get-Location).Path
        Set-Location -LiteralPath $release; $expected=(Get-Location).Path; Set-Location $before
        try { $result=& (Join-Path $root 'launch.ps1'); $result[0] | Should Be $expected; $result[1] | Should Be 'src/local-server.mjs' } finally {Set-Location $before}
    }
    It 'rejects invalid active pointers without launching a process' {
        $root=Join-Path $TestDrive 'bad-root'; New-Item -ItemType Directory $root | Out-Null
        Set-Content (Join-Path $root 'active.txt') '../escape'
        Set-Content (Join-Path $root 'launch.ps1') (Get-DeploymentLauncher)
        Assert-Throws { & (Join-Path $root 'launch.ps1') }
    }
    It 'activates a healthy release using only injected operations' {
        $state=@{Pointer=$sha; Events=@()}
        Invoke-DeploymentActivation -Sha ('b'*40) -Old $sha -WritePointer {param($v) $state.Pointer=$v; $state.Events+='write'} -RemovePointer {$state.Pointer=$null} -Restart {$state.Events+='restart'} -Stop {$state.Events+='stop'} -Healthy {$true}
        $state.Pointer | Should Be ('b'*40); ($state.Events -join ',') | Should Be 'write,restart'
    }
    It 'restores the known-good pointer before restarting on failed health or restart' {
        foreach($failure in @('health','restart')) {
            $state=@{Pointer=$sha; Events=@(); Restarts=0}
            Assert-Throws { Invoke-DeploymentActivation -Sha ('b'*40) -Old $sha -WritePointer {param($v) $state.Pointer=$v; $state.Events+=('write:'+ $v)} -RemovePointer {$state.Pointer=$null} -Restart {$state.Restarts++; $state.Events+='restart'; if($failure -eq 'restart' -and $state.Restarts -eq 1){throw 'restart failed'}} -Stop {$state.Events+='stop'} -Healthy {$false} }
            $state.Pointer | Should Be $sha; $state.Restarts | Should Be 2
            $state.Events[2] | Should Be ('write:'+ $sha)
        }
    }
    It 'removes the candidate pointer and stops when there was no prior release' {
        $state=@{Pointer=$null; Events=@()}
        Assert-Throws { Invoke-DeploymentActivation -Sha $sha -Old '' -WritePointer {param($v) $state.Pointer=$v} -RemovePointer {$state.Pointer=$null; $state.Events+='remove'} -Restart {$state.Events+='restart'} -Stop {$state.Events+='stop'} -Healthy {$false} }
        ($null -eq $state.Pointer) | Should Be $true; ($state.Events -join ',') | Should Be 'restart,remove,stop'
    }
    It 'does not restart when the candidate pointer write fails and preserves recovery failure' {
        $state=@{Restarts=0}
        Assert-Throws { Invoke-DeploymentActivation -Sha $sha -Old ('b'*40) -WritePointer {throw 'write denied'} -RemovePointer {} -Restart {$state.Restarts++} -Stop {} -Healthy {$true} }
        $state.Restarts | Should Be 0
    }
    It 'reports activation and recovery failure together without claiming rollback success' {
        $state=@{Writes=0}; $message=''
        try {
            Invoke-DeploymentActivation -Sha $sha -Old ('b'*40) -WritePointer {param($v) $state.Writes++; if($state.Writes -gt 1){throw 'recovery denied'}} -RemovePointer {} -Restart {throw 'activation restart failed'} -Stop {} -Healthy {$true}
        } catch { $message=$_.Exception.Message }
        $message | Should Match 'activation restart failed.*rollback failed: recovery denied'
    }
}
