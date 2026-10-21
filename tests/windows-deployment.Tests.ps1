$ErrorActionPreference = 'Stop'
$repository = Split-Path $PSScriptRoot -Parent

# Pester 3's Should Throw assertion is incompatible with PowerShell 7's null conversion.
# Assert a caught exception explicitly so the same fixtures work in PS 5.1 and 7.
function Assert-Throws([scriptblock]$Operation) {
    $caught=$false
    try { & $Operation | Out-Null } catch { $caught=$true }
    $caught | Should Be $true
}

function New-FixtureJunction([string]$Path,[string]$Target) {
    # Windows PowerShell resolves the Target parameter as a wildcard path.
    if ($PSVersionTable.PSVersion.Major -le 5) { $Target=[WildcardPattern]::Escape($Target) }
    New-Item -ItemType Junction -Path $Path -Target $Target
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

Describe 'Release source association' {
    . (Join-Path $repository 'scripts/windows-deployment.ps1')
    function New-ReleaseFixture {
        $root=Join-Path $TestDrive ([guid]::NewGuid().ToString('N')+" root's [fixture]")
        $repo=Join-Path $root 'repository'; $release=Join-Path $root 'release'
        New-Item -ItemType Directory -Force $repo | Out-Null
        & git -C $repo init -q
        & git -C $repo config core.autocrlf true
        & git -C $repo config core.safecrlf false
        & git -C $repo config user.email fixture@example.invalid
        & git -C $repo config user.name Fixture
        New-Item -ItemType Directory (Join-Path $repo 'scripts') | Out-Null
        [IO.File]::WriteAllText((Join-Path $repo 'scripts/test-full-ci.mjs'),"console.log('fixture');`n")
        [IO.File]::WriteAllText((Join-Path $repo 'source.txt'),"original`n")
        & git -C $repo add .
        & git -C $repo commit -qm fixture
        $head=(& git -C $repo rev-parse HEAD).Trim()
        & git -C $repo worktree add --quiet --detach $release $head
        @{Repo=$repo; Target=$release; Sha=$head; Root=$root}
    }
    function Assert-Release($f) { Assert-DeploymentRelease -Repository $f.Repo -Target $f.Target -Sha $f.Sha -Git (Get-Command git).Source }
    It 'accepts and reuses an exact clean associated worktree with generated dependencies' {
        $f=New-ReleaseFixture
        New-Item -ItemType Directory (Join-Path $f.Target 'node_modules') | Out-Null
        [IO.File]::WriteAllText((Join-Path $f.Target 'node_modules/generated.txt'),'dependency')
        Assert-Release $f; Assert-Release $f
    }
    It 'rejects an ordinary SHA-named directory before its runner executes' {
        $f=New-ReleaseFixture; $f.Target=Join-Path $f.Root $f.Sha
        New-Item -ItemType Directory $f.Target | Out-Null
        Assert-Throws { Assert-Release $f }
    }
    It 'rejects wrong HEAD and a worktree from another repository' {
        $f=New-ReleaseFixture; $f.Sha='a'*40; Assert-Throws { Assert-Release $f }
        $f=New-ReleaseFixture; $other=New-ReleaseFixture; $f.Repo=$other.Repo
        Assert-Throws { Assert-Release $f }
    }
    It 'rejects dirty tracked source even when assume-unchanged hides it from status' {
        $f=New-ReleaseFixture
        & git -C $f.Target update-index --assume-unchanged source.txt
        [IO.File]::WriteAllText((Join-Path $f.Target 'source.txt'),'changed')
        Assert-Throws { Assert-Release $f }
    }
    It 'rejects altered runner and source changed between test and activation checks' {
        $f=New-ReleaseFixture; Assert-Release $f
        & git -C $f.Target update-index --assume-unchanged scripts/test-full-ci.mjs
        [IO.File]::WriteAllText((Join-Path $f.Target 'scripts/test-full-ci.mjs'),'process.exit(0)')
        Assert-Throws { Assert-Release $f }
    }
    It 'rejects staged source and untracked executable source' {
        $f=New-ReleaseFixture
        [IO.File]::WriteAllText((Join-Path $f.Target 'source.txt'),'changed'); & git -C $f.Target add source.txt
        Assert-Throws { Assert-Release $f }
        $f=New-ReleaseFixture
        [IO.File]::WriteAllText((Join-Path $f.Target 'injected.mjs'),'export default 1')
        Assert-Throws { Assert-Release $f }
    }
    It 'rejects a tracked Git symlink even when checkout materializes it as text' {
        $f=New-ReleaseFixture
        $blob=(& git -C $f.Repo rev-parse HEAD:source.txt).Trim()
        & git -C $f.Repo update-index --add --cacheinfo "120000,$blob,link"
        & git -C $f.Repo commit -qm symlink
        $f.Sha=(& git -C $f.Repo rev-parse HEAD).Trim()
        & git -C $f.Target -c core.symlinks=false reset --hard $f.Sha | Out-Null
        Assert-Throws { Assert-Release $f }
    }
    It 'rejects binary CRLF changes and source mutation by a synthetic runner' {
        $f=New-ReleaseFixture
        [IO.File]::WriteAllBytes((Join-Path $f.Repo 'binary.bin'),[byte[]](255,13,10,0,1))
        & git -C $f.Repo add binary.bin; & git -C $f.Repo commit -qm binary
        $f.Sha=(& git -C $f.Repo rev-parse HEAD).Trim()
        & git -C $f.Target reset --hard $f.Sha | Out-Null
        Assert-Release $f
        [IO.File]::WriteAllBytes((Join-Path $f.Target 'binary.bin'),[byte[]](255,10,0,1))
        Assert-Throws { Assert-Release $f }
        $f=New-ReleaseFixture; Assert-Release $f
        & node -e "require('fs').writeFileSync(process.argv[1], 'changed by synthetic runner')" (Join-Path $f.Target 'source.txt')
        Assert-Throws { Assert-Release $f }
    }
    It 'accepts raw blob bytes when autocrlf is unset in isolated fixture configuration' {
        $f=New-ReleaseFixture
        & git -C $f.Repo config --unset core.autocrlf
        [IO.File]::WriteAllText((Join-Path $f.Target 'source.txt'),"original`n")
        [IO.File]::WriteAllText((Join-Path $f.Target 'scripts/test-full-ci.mjs'),"console.log('fixture');`n")
        $globalConfig=$env:GIT_CONFIG_GLOBAL; $noSystem=$env:GIT_CONFIG_NOSYSTEM
        try {
            $env:GIT_CONFIG_GLOBAL=Join-Path $f.Root 'empty-config'; [IO.File]::WriteAllText($env:GIT_CONFIG_GLOBAL,'')
            $env:GIT_CONFIG_NOSYSTEM='1'
            Assert-Release $f
        } finally {$env:GIT_CONFIG_GLOBAL=$globalConfig; $env:GIT_CONFIG_NOSYSTEM=$noSystem}
    }
    It 'runs the actual candidate test block then refuses source changed by its runner' {
        $f=New-ReleaseFixture
        [IO.File]::WriteAllText((Join-Path $f.Repo 'scripts/test-full-ci.mjs'),"import {writeFileSync} from 'node:fs';writeFileSync('source.txt','modified during fixture test');`n")
        & git -C $f.Repo add scripts/test-full-ci.mjs; & git -C $f.Repo commit -qm mutation-runner
        $f.Sha=(& git -C $f.Repo rev-parse HEAD).Trim()
        $releases=$f.Root; $sha=$f.Sha; $git=(@(Get-Command git -CommandType Application)[0]).Source; $node=(@(Get-Command node -CommandType Application)[0]).Source
        $f.Target=Join-Path $releases $sha
        & git -C $f.Repo worktree add --quiet --detach $f.Target $sha
        $gitDir=$f.Repo
        $updater=Get-Content -LiteralPath (Join-Path $repository 'scripts/windows-update.ps1') -Raw
        $start=$updater.IndexOf(' $target=Join-Path $releases $sha'); $end=$updater.IndexOf(' if($Install){',$start)
        & ([scriptblock]::Create($updater.Substring($start,$end-$start)))
        (Get-Content -LiteralPath (Join-Path $f.Target 'source.txt') -Raw) | Should Be 'modified during fixture test'
        Assert-Throws { Assert-Release $f }
    }
    It 'rejects a submodule tree entry without invoking a submodule or network' {
        $f=New-ReleaseFixture
        & git -C $f.Repo update-index --add --cacheinfo "160000,$($f.Sha),module"
        & git -C $f.Repo commit -qm submodule
        $f.Sha=(& git -C $f.Repo rev-parse HEAD).Trim()
        & git -C $f.Target reset --hard $f.Sha | Out-Null
        Assert-Throws { Assert-Release $f }
    }
    It 'rejects lexical path aliases and junction paths' {
        $f=New-ReleaseFixture; $original=$f.Target; $f.Target=$original+'\..\release'
        Assert-Throws { Assert-Release $f }
        $alias=Join-Path $f.Root 'alias'
        New-FixtureJunction -Path $alias -Target $original | Out-Null
        try {$f.Target=$alias; Assert-Throws { Assert-Release $f }} finally { [IO.Directory]::Delete($alias) }
    }
    It 'rejects a reparse point inside tracked source' {
        $f=New-ReleaseFixture; $directory=Join-Path $f.Root 'elsewhere'
        New-Item -ItemType Directory $directory | Out-Null
        $alias=Join-Path $f.Target 'injected'
        New-FixtureJunction -Path $alias -Target $directory | Out-Null
        try { Assert-Throws { Assert-Release $f } } finally { [IO.Directory]::Delete($alias) }
    }
}

Describe 'Release source boundary regressions' {
    . (Join-Path $repository 'scripts/windows-deployment.ps1')
    It 'checks tracked binary bytes without text normalization' {
        $bytes=[byte[]](255,13,10,0,1)
        (Get-DeploymentBlobHash $bytes) | Should Not Be (Get-DeploymentBlobHash ([byte[]](255,10,0,1)))
    }
    It 'places source validation before candidate runner and immediately before candidate pointer' {
        $source=Get-Content -LiteralPath (Join-Path $repository 'scripts/windows-update.ps1') -Raw
        $source | Should Match 'Assert-DeploymentRelease[^\r\n]+\r?\n Push-Location -LiteralPath \$target'
        $source | Should Match 'if\(\$value -ceq \$sha\)\{Assert-DeploymentRelease[^\r\n]+\}\r?\n  # Same-volume atomic replacement:[^\r\n]+\r?\n  Write-DeploymentPointer'
    }
}

Describe 'Release artifact provenance contracts' {
    . (Join-Path $repository 'scripts/windows-deployment.ps1')
    Add-Type -AssemblyName System.IO.Compression
    function New-ProvenanceFixture($Change=@{}) {
        $manifest=@{schema=1;qualified=$true;sourceEvidence='self-reported-pre-post-tracked-tree/v1';testedWorktreeVerified=$true;committedTreeSha=('e'*40);trackedSourceSha256=('f'*64);dependencyPolicy='math-dependency-contract/v1';packageManifestSha256=('c'*64);pythonRequirementsSha256=('d'*64);sourceSha=('a'*40);lockSha256=('b'*64);repository='YehorBabenko88/math';workflowPath='.github/workflows/ci.yml';runId='7';runAttempt='2';context='test'}
        foreach($key in $Change.Keys){$manifest[$key]=$Change[$key]}
        $stream=New-Object IO.MemoryStream
        $zip=New-Object IO.Compression.ZipArchive($stream,[IO.Compression.ZipArchiveMode]::Create,$true)
        $entry=$zip.CreateEntry('release-provenance.json');$writer=New-Object IO.StreamWriter($entry.Open())
        $writer.Write(($manifest | ConvertTo-Json -Compress));$writer.Dispose();$zip.Dispose()
        $bytes=$stream.ToArray();$stream.Dispose()
        $hash=[Security.Cryptography.SHA256]::Create()
        try {$digest=([BitConverter]::ToString($hash.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()} finally {$hash.Dispose()}
        @{Run=[pscustomobject]@{id=7;run_attempt=2;path='.github/workflows/ci.yml'};Bytes=$bytes;Artifact=[pscustomobject]@{id=9;name='release-provenance-7-2-test';expired=$false;digest=('sha256:'+$digest);size_in_bytes=$bytes.Length;workflow_run=[pscustomobject]@{id=7;head_sha=('a'*40)}}}
    }
    function Assert-ProvenanceFixture($f) {
        Assert-DeploymentProvenance -Sha ('a'*40) -LockHash ('b'*64) -Run $f.Run -Artifacts @($f.Artifact) -Contexts @('test') -DependencyEvidence @{lockSha256=('b'*64);packageManifestSha256=('c'*64);pythonRequirementsSha256=('d'*64)} -Download {param($artifact) return ,$f.Bytes}
    }
    It 'accepts downloaded digest checked exact source lock run attempt and context evidence' {Assert-ProvenanceFixture (New-ProvenanceFixture)}
    It 'rejects stale reruns wrong source lock repository workflow run and missing contexts' {
        foreach($change in @(@{runAttempt='1'},@{sourceSha=('c'*40)},@{lockSha256=('c'*64)},@{repository='other/math'},@{workflowPath='other.yml'},@{runId='8'},@{context='other'},@{qualified=$false},@{qualified='true'},@{lockSha256=$null},@{dependencyPolicy=$null},@{packageManifestSha256=('e'*64)},@{pythonRequirementsSha256=('e'*64)})) {
            Assert-Throws {Assert-ProvenanceFixture (New-ProvenanceFixture $change)}
        }
    }
    It 'rejects archive bytes changed after GitHub digest verification metadata' {
        $f=New-ProvenanceFixture;$f.Bytes[0]=$f.Bytes[0] -bxor 1
        Assert-Throws {Assert-ProvenanceFixture $f}
    }
    It 'rejects expired absent digest wrong metadata run and SHA artifacts' {
        foreach($change in @(@{id=0},@{size_in_bytes=0},@{size_in_bytes=1048577},@{expired=$true},@{digest=$null},@{digest=('sha256:'+('0'*64))},@{workflow_run=[pscustomobject]@{id=8;head_sha=('a'*40)}},@{workflow_run=[pscustomobject]@{id=7;head_sha=('c'*40)}})) {
            $f=New-ProvenanceFixture;foreach($key in $change.Keys){$f.Artifact.$key=$change[$key]}
            Assert-Throws {Assert-ProvenanceFixture $f}
        }
    }
    It 'rejects provenance without pre/post tested source evidence' {
        foreach($change in @(@{sourceEvidence=$null},@{testedWorktreeVerified=$false},@{testedWorktreeVerified='true'},@{committedTreeSha='invalid'},@{trackedSourceSha256=$null})) {
            $f=New-ProvenanceFixture $change
            {Assert-DeploymentProvenance -Sha ('a'*40) -LockHash ('b'*64) -Run $f.Run -Artifacts @($f.Artifact) -Contexts @('test') -Download {param($artifact) return ,$f.Bytes}} | Should Throw
        }
    }
    It 'rejects missing and duplicate provenance contexts' {
        $f=New-ProvenanceFixture
        Assert-Throws {Assert-DeploymentProvenance -Sha ('a'*40) -LockHash ('b'*64) -Run $f.Run -Artifacts @() -Contexts @('test') -Download {throw 'must not download'}}
        Assert-Throws {Assert-DeploymentProvenance -Sha ('a'*40) -LockHash ('b'*64) -Run $f.Run -Artifacts @($f.Artifact,$f.Artifact) -Contexts @('test') -Download {return ,$f.Bytes}}
    }
    It 'hashes exact committed lock bytes and refuses a missing lock in a custom root' {
        $root=Join-Path $TestDrive "lock fixture O'Brien [custom]";New-Item -ItemType Directory -Path $root | Out-Null
        & git init --quiet $root
        & git -C $root -c user.name=Fixture -c user.email=fixture@example.invalid commit --quiet --allow-empty -m initial
        $missing=(& git -C $root rev-parse HEAD).Trim()
        Assert-Throws {Get-DeploymentLockHash -Repository $root -Sha $missing -Git (Get-Command git).Source}
        $bytes=[Text.Encoding]::UTF8.GetBytes('{"lockfileVersion":3}'+[char]10)
        [IO.File]::WriteAllBytes((Join-Path $root 'package-lock.json'),$bytes)
        & git -C $root -c core.autocrlf=false add package-lock.json
        & git -C $root -c user.name=Fixture -c user.email=fixture@example.invalid commit --quiet -m lock
        $sha=(& git -C $root rev-parse HEAD).Trim()
        $hash=[Security.Cryptography.SHA256]::Create()
        try {$expected=([BitConverter]::ToString($hash.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()} finally {$hash.Dispose()}
        (Get-DeploymentLockHash -Repository $root -Sha $sha -Git (Get-Command git).Source) | Should Be $expected
        [IO.File]::WriteAllText((Join-Path $root 'package-lock.json'),'disk mutation')
        (Get-DeploymentLockHash -Repository $root -Sha $sha -Git (Get-Command git).Source) | Should Be $expected
    }

    It 'ignores older attempt archives while requiring all current attempt contexts' {
        $f=New-ProvenanceFixture; $old=$f.Artifact.PSObject.Copy();$old.name='release-provenance-7-1-test';$old.digest=$null
        Assert-DeploymentProvenance -Sha ('a'*40) -LockHash ('b'*64) -Run $f.Run -Artifacts @($old,$f.Artifact) -Contexts @('test') -Download {return ,$f.Bytes}
        Assert-Throws {Assert-DeploymentProvenance -Sha ('a'*40) -LockHash ('b'*64) -Run $f.Run -Artifacts @($old) -Contexts @('test') -Download {throw 'must not download'}}
    }
}

Describe 'Windows SQL checkout gate' {
    It 'stops the actual workflow block after a failing native verifier before running the unit command' {
        $workflow=Get-Content (Join-Path $repository '.github/workflows/windows-deployment.yml') -Raw
        $match=[regex]::Match($workflow,'(?m)^      - name: Verify committed SQL checkout bytes and checkout policy\r?\n        run: \|\r?\n(?<body>(?:          [^\r\n]*\r?\n)+)')
        $match.Success | Should Be $true
        $block=[regex]::Replace($match.Groups['body'].Value,'(?m)^          ','')
        $block.Contains('node scripts/verify-sql-bytes.mjs') | Should Be $true
        $block.Contains('node --test tests/sql-byte-reproducibility.test.mjs') | Should Be $true
        $block=$block.Replace('node scripts/verify-sql-bytes.mjs','node -e "process.exit(7)"').Replace('node --test tests/sql-byte-reproducibility.test.mjs tests/sql-byte-integrity.test.mjs','$script:sqlGateSecondCommandRan = $true')
        $script:sqlGateSecondCommandRan=$false
        # Reproduce Windows PowerShell native-exit semantics even on newer pwsh.
        $PSNativeCommandUseErrorActionPreference=$false
        $failure=$null
        try { & ([scriptblock]::Create($block)) } catch { $failure=$_.Exception.Message }
        $failure | Should Be "SQL checkout-byte verification failed: 7"
        $script:sqlGateSecondCommandRan | Should Be $false
    }
}

Describe 'Integrated committed dependency gate' {
    . (Join-Path $repository 'scripts/windows-deployment.ps1')
    It 'validates actual committed contracts before qualifying the release' {
        $sha=(& git -C $repository rev-parse HEAD).Trim()
        $actual=Get-DeploymentDependencyEvidence -Repository $repository -Sha $sha
        $actual.dependencyPolicy | Should Be 'math-dependency-contract/v1'
        $actual.sourceSha | Should Be $sha
        $invalid=Join-Path $TestDrive 'invalid committed lock';New-Item -ItemType Directory $invalid | Out-Null
        & git init --quiet $invalid
        [IO.File]::WriteAllText((Join-Path $invalid 'package-lock.json'),'{"lockfileVersion":3}')
        & git -C $invalid add .
        & git -C $invalid -c user.name=Fixture -c user.email=fixture@example.invalid commit --quiet -m invalid
        $bad=(& git -C $invalid rev-parse HEAD).Trim()
        Assert-Throws {Get-DeploymentDependencyEvidence -Repository $invalid -Sha $bad}
    }
}
