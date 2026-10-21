# Pure deployment contracts. Dot-sourcing this file performs no external operations.
function Enter-DeploymentLock {
    param([string]$Root)
    [IO.File]::Open((Join-Path $Root '.update.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
}

function Write-DeploymentPointer {
    param([string]$Path,[string]$Sha)
    if ($Sha -cnotmatch '^[a-f0-9]{40}$') { throw 'Invalid release pointer' }
    $temporary=Join-Path (Split-Path -Parent $Path) ([guid]::NewGuid().ToString()+'.active.tmp')
    try {
        [IO.File]::WriteAllText($temporary,$Sha)
        if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($temporary,$Path,[System.Management.Automation.Language.NullString]::Value) }
        else { [IO.File]::Move($temporary,$Path) }
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary }
    }
}

function Get-RequiredDeploymentWorkflows {
    @(
        @{Id=385218509; Path='.github/workflows/postgres-integration.yml'; Jobs=@('Full suite Node 22 / PostgreSQL 16','Full suite Node 22 / PostgreSQL 18','Full suite Node 24 / PostgreSQL 16','Full suite Node 24 / PostgreSQL 18','Full CI coverage')},
        @{Id=385287115; Path='.github/workflows/book-ingestion.yml'; Jobs=@('native-pdf')},
        @{Id=384037321; Path='.github/workflows/browser.yml'; Jobs=@('chromium')},
        @{Id=384027546; Path='.github/workflows/ci.yml'; Jobs=@('test')},
        @{Id=389263787; Path='.github/workflows/windows-deployment.yml'; Jobs=@('Windows contracts / powershell','Windows contracts / pwsh')}
    )
}

function Get-DeploymentUpdatedAt {
    param($Value)
    if ($Value -is [DateTimeOffset]) { return $Value.ToUniversalTime() }
    if ($Value -is [DateTime]) {
        if ($Value.Kind -eq [DateTimeKind]::Unspecified) { throw 'Workflow timestamp has no timezone' }
        return [DateTimeOffset]($Value.ToUniversalTime())
    }
    $timestamp=[DateTimeOffset]::MinValue
    if ($Value -isnot [string] -or $Value -cnotmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$' -or
        ![DateTimeOffset]::TryParse($Value,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::AdjustToUniversal,[ref]$timestamp)) {
        throw 'Invalid workflow update timestamp'
    }
    return $timestamp
}

function Assert-DeploymentChecks {
    param([string]$Sha, [string]$Branch, [object[]]$Runs, [scriptblock]$GetJobs)
    if ($Sha -cnotmatch '^[a-f0-9]{40}$' -or [string]::IsNullOrWhiteSpace($Branch)) { throw 'Invalid deployment identity' }
    foreach ($workflow in (Get-RequiredDeploymentWorkflows)) {
        $relevant = @($Runs | Where-Object { $_.workflow_id -eq $workflow.Id -and $_.head_sha -ceq $Sha })
        $candidates=@()
        foreach ($entry in $relevant) {
            foreach ($field in @('id','run_number','run_attempt')) {
                $number=0L
                if (![long]::TryParse([string]$entry.$field,[ref]$number) -or $number -lt 1) { throw "Invalid workflow metadata: $field" }
            }
            # PS 5.1 JSON dates are strings; PS 7 may deserialize them to DateTime.
            # Normalize once, without stringify/reparse, for both validation and ordering.
            $candidates+=@([pscustomobject]@{Run=$entry; UpdatedAt=(Get-DeploymentUpdatedAt $entry.updated_at)})
        }
        # A rerun of an older run can be the newest activity. Never fall back to old green.
        $matching = @($candidates | Sort-Object -Property @{Expression={$_.UpdatedAt}; Descending=$true},
            @{Expression={[long]$_.Run.run_number}; Descending=$true}, @{Expression={[long]$_.Run.id}; Descending=$true}, @{Expression={[long]$_.Run.run_attempt}; Descending=$true})
        if (!$matching.Count) { throw "Missing trusted workflow: $($workflow.Path)" }
        $run = $matching[0].Run
        # GitHub timestamps have finite precision. A tied failed/pending attempt cannot be
        # ordered reliably against green activity, so refuse that ambiguous snapshot.
        foreach ($tied in @($matching | Where-Object { $_.UpdatedAt -eq $matching[0].UpdatedAt })) {
            if ($tied.Run.status -cne 'completed' -or $tied.Run.conclusion -cne 'success') { throw 'Ambiguous latest workflow activity is not green' }
        }
        if ($run.path -cne $workflow.Path -or $run.repository.full_name -cne 'YehorBabenko88/math' -or
            $run.head_repository.full_name -cne 'YehorBabenko88/math' -or $run.head_branch -cne $Branch -or
            $run.event -cne 'push' -or $run.status -cne 'completed' -or $run.conclusion -cne 'success' -or
            [int]$run.run_attempt -lt 1 -or [long]$run.id -lt 1 -or [long]$run.run_number -lt 1) {
            throw "Current workflow is not trusted and green: $($workflow.Path)"
        }
        $jobs = @(& $GetJobs $run)
        foreach ($name in $workflow.Jobs) {
            $checks = @($jobs | Where-Object {$_.name -ceq $name})
            if ($checks.Count -ne 1 -or $checks[0].head_sha -cne $Sha -or
                [int]$checks[0].run_attempt -ne [int]$run.run_attempt -or
                $checks[0].status -cne 'completed' -or $checks[0].conclusion -cne 'success') {
                throw "Missing current successful check: $name"
            }
        }
    }
}

function Get-DeploymentLauncher {
    # The launcher's own directory is the configured Root: no path interpolation or quoting.
    @'
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$sha=(Get-Content -LiteralPath (Join-Path $root 'active.txt') -Raw).Trim()
if($sha -cnotmatch '^[a-f0-9]{40}$'){throw 'Invalid active release'}
Set-Location -LiteralPath (Join-Path (Join-Path $root 'releases') $sha)
& node 'src/local-server.mjs'
if($LASTEXITCODE -ne 0){throw 'Server exited unsuccessfully'}
'@
}

function Invoke-DeploymentActivation {
    param([string]$Sha, [string]$Old, [scriptblock]$WritePointer, [scriptblock]$RemovePointer,
        [scriptblock]$Restart, [scriptblock]$Stop, [scriptblock]$Healthy)
    if ($Sha -cnotmatch '^[a-f0-9]{40}$' -or ($Old -and $Old -cnotmatch '^[a-f0-9]{40}$')) { throw 'Invalid release pointer' }
    try {
        & $WritePointer $Sha
        & $Restart
        if (!(& $Healthy)) { throw 'Health check failed' }
    } catch {
        $activationFailure = $_
        try {
            if ($Old) { & $WritePointer $Old; & $Restart }
            else { & $RemovePointer; & $Stop }
        } catch {
            throw "Activation failed: $($activationFailure.Exception.Message); rollback failed: $($_.Exception.Message)"
        }
        throw $activationFailure
    }
}

# Read-only source association. Does not execute candidate code, filters, hooks or updater actions.
function Assert-DeploymentCanonicalPath {
    param([string]$Path)
    if (![IO.Path]::IsPathRooted($Path) -or $Path.Replace('/','\').TrimEnd('\','/') -ine [IO.Path]::GetFullPath($Path).TrimEnd('\','/')) { throw 'Release path alias is not allowed' }
    $item=Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    while ($null -ne $item) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Release reparse point is not allowed' }
        $item=if($item -is [IO.DirectoryInfo]){$item.Parent}else{$item.Directory}
    }
}

function Get-DeploymentBlobHash {
    param([byte[]]$Bytes)
    $hash=[Security.Cryptography.SHA1]::Create()
    try {
        $prefix=[Text.Encoding]::ASCII.GetBytes("blob $($Bytes.Length)`0")
        $null=$hash.TransformBlock($prefix,0,$prefix.Length,$prefix,0)
        $null=$hash.TransformFinalBlock($Bytes,0,$Bytes.Length)
        return ([BitConverter]::ToString($hash.Hash)).Replace('-','').ToLowerInvariant()
    } finally { $hash.Dispose() }
}

function Assert-DeploymentRelease {
    param([string]$Repository,[string]$Target,[string]$Sha,[string]$Git)
    if ($Sha -cnotmatch '^[a-f0-9]{40}$') { throw 'Invalid release SHA' }
    Assert-DeploymentCanonicalPath $Repository
    Assert-DeploymentCanonicalPath $Target
    function Read-ReleaseGit([string]$Directory,[string[]]$Arguments) {
        $result=@(& $Git --no-replace-objects -c core.fsmonitor=false -C $Directory @Arguments 2>$null)
        if ($LASTEXITCODE -ne 0) { throw 'Release Git association failed' }
        return $result
    }
    $expectedCommon=([string](Read-ReleaseGit $Repository @('rev-parse','--path-format=absolute','--git-common-dir'))).Trim()
    $common=([string](Read-ReleaseGit $Target @('rev-parse','--path-format=absolute','--git-common-dir'))).Trim()
    $top=([string](Read-ReleaseGit $Target @('rev-parse','--show-toplevel'))).Trim()
    $administration=([string](Read-ReleaseGit $Target @('rev-parse','--absolute-git-dir'))).Trim()
    if ([IO.Path]::GetFullPath($common) -ine [IO.Path]::GetFullPath($expectedCommon) -or
        [IO.Path]::GetFullPath($top) -ine [IO.Path]::GetFullPath($Target) -or
        !([IO.Path]::GetFullPath($administration).StartsWith(([IO.Path]::GetFullPath($expectedCommon).TrimEnd('\','/')+'\worktrees\'),[StringComparison]::OrdinalIgnoreCase))) { throw 'Release belongs to a different repository or is not a linked worktree' }
    Assert-DeploymentCanonicalPath $expectedCommon
    Assert-DeploymentCanonicalPath $administration
    $registered=Read-ReleaseGit $Repository @('worktree','list','--porcelain')
    $entry='worktree '+$Target.Replace('\','/')
    if (!(@($registered | Where-Object { $_ -ieq $entry }).Count)) { throw 'Release is not a registered worktree' }
    $head=([string](Read-ReleaseGit $Target @('rev-parse','HEAD'))).Trim()
    if ($head -cne $Sha) { throw 'Release HEAD differs from candidate SHA' }
    # Index mutations are rejected separately; actual bytes below bypass index stat/skip flags.
    $indexChanges=Read-ReleaseGit $Target @('diff-index','--cached','--name-only',$Sha,'--')
    if ($indexChanges.Count) { throw 'Release index differs from candidate SHA' }
    $tree=Read-ReleaseGit $Repository @('-c','core.quotePath=true','ls-tree','-r','--full-tree',$Sha)
    $tracked=@{}
    $autocrlf=([string](Read-ReleaseGit $Repository @('config','--default','false','--get','core.autocrlf'))).Trim()
    foreach ($line in $tree) {
        if ($line -cnotmatch '^100(?:644|755) blob ([a-f0-9]{40})\t([A-Za-z0-9_. /@+()\[\]-]+)$') { throw 'Unsupported release tree entry (including symlink or submodule)' }
        $blob=$Matches[1]; $relative=$Matches[2]
        if ($relative.Split('/') -contains '..') { throw 'Invalid release tree path' }
        $file=Join-Path $Target $relative
        Assert-DeploymentCanonicalPath $file
        $bytes=[IO.File]::ReadAllBytes($file)
        if ((Get-DeploymentBlobHash $bytes) -cne $blob) {
            # Account only for Git text checkout CRLF conversion, never rewrite any bytes.
            $attributes=Read-ReleaseGit $Repository @('check-attr',"--source=$Sha",'text','eol','--',$relative)
            $text=([string]$attributes[0]).Substring(($relative+': text: ').Length)
            $eol=([string]$attributes[1]).Substring(($relative+': eol: ').Length)
            $conversion=($text -ne 'unset' -and $eol -ne 'lf' -and ($eol -eq 'crlf' -or $autocrlf -eq 'true'))
            if (!$conversion -or ($bytes -contains 0)) { throw 'Release tracked bytes differ from candidate' }
            try { $decoded=(New-Object Text.UTF8Encoding($false,$true)).GetString($bytes) } catch { throw 'Release binary bytes differ from candidate' }
            if ($decoded -match '(?<!\r)\n|\r(?!\n)') { throw 'Release has noncanonical text checkout bytes' }
            $normalized=[Text.Encoding]::UTF8.GetBytes($decoded.Replace("`r`n","`n"))
            if ((Get-DeploymentBlobHash $normalized) -cne $blob) { throw 'Release tracked bytes differ from candidate' }
        }
        $tracked[$relative.Replace('/','\')]=$true
    }
    # Generated dependencies/results are explicitly mutable, not attested artifacts.
    $pending=New-Object 'System.Collections.Generic.Stack[string]'; $pending.Push($Target)
    while ($pending.Count) {
        $directory=$pending.Pop()
        foreach ($item in Get-ChildItem -LiteralPath $directory -Force) {
            $relative=$item.FullName.Substring($Target.TrimEnd('\','/').Length+1)
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Release contains a reparse point' }
            if ($relative -eq '.git') { continue }
            if ($relative -match '^(node_modules|test-results)(\\|$)' -or $relative -match '(^|\\)__pycache__(\\|$)') { continue }
            if ($item.PSIsContainer) { $pending.Push($item.FullName) }
            elseif (!$tracked.ContainsKey($relative)) { throw 'Release contains untracked source' }
        }
    }
}

function Get-DeploymentLockHash {
    param([string]$Repository,[string]$Sha,[string]$Git)
    if($Sha -cnotmatch '^[a-f0-9]{40}$'){throw 'Invalid provenance source SHA'}
    $start=New-Object Diagnostics.ProcessStartInfo
    $start.FileName=$Git
    $start.Arguments="--no-replace-objects -C `"$Repository`" cat-file blob ${Sha}:package-lock.json"
    $start.UseShellExecute=$false; $start.CreateNoWindow=$true
    $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
    $process=New-Object Diagnostics.Process; $process.StartInfo=$start
    $bytes=New-Object IO.MemoryStream
    try {
        $null=$process.Start(); $errorRead=$process.StandardError.ReadToEndAsync()
        $process.StandardOutput.BaseStream.CopyTo($bytes); $process.WaitForExit()
        if($process.ExitCode -ne 0){throw 'Candidate has no committed dependency lockfile'}
        $hash=[Security.Cryptography.SHA256]::Create()
        try {return ([BitConverter]::ToString($hash.ComputeHash($bytes.ToArray()))).Replace('-','').ToLowerInvariant()} finally {$hash.Dispose()}
    } finally {$bytes.Dispose();$process.Dispose()}
}

function Get-DeploymentDependencyEvidence {
    param([string]$Repository,[string]$Sha)
    if($Sha -cnotmatch '^[a-f0-9]{40}$'){throw 'Invalid dependency source SHA'}
    $node=(Get-Command node -ErrorAction Stop).Source
    $json=& $node (Join-Path $PSScriptRoot 'verify-dependency-locks.mjs') --git-source $Repository $Sha
    if($LASTEXITCODE -ne 0){throw 'Committed dependency contracts failed validation'}
    $evidence=$json | ConvertFrom-Json
    if($evidence.sourceSha -cne $Sha -or $evidence.dependencyPolicy -cne 'math-dependency-contract/v1' -or
       $evidence.lockSha256 -cnotmatch '^[a-f0-9]{64}$' -or $evidence.packageManifestSha256 -cnotmatch '^[a-f0-9]{64}$' -or
       $evidence.pythonRequirementsSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Invalid committed dependency evidence'}
    return $evidence
}

function Assert-DeploymentProvenance {
    param([string]$Sha,[string]$LockHash,$Run,[object[]]$Artifacts,[string[]]$Contexts,[scriptblock]$Download,$DependencyEvidence)
    if($Sha -cnotmatch '^[a-f0-9]{40}$' -or $LockHash -cnotmatch '^[a-f0-9]{64}$'){throw 'Missing source dependency provenance'}
    Add-Type -AssemblyName System.IO.Compression
    $seen=@{}
    $prefix="release-provenance-$($Run.id)-$($Run.run_attempt)-"
    foreach($artifact in @($Artifacts | Where-Object {$_.name -clike ($prefix+'*')})) {
        $artifactId=0L; $artifactSize=0L
        if(![long]::TryParse([string]$artifact.id,[ref]$artifactId) -or $artifactId -lt 1 -or
            ![long]::TryParse([string]$artifact.size_in_bytes,[ref]$artifactSize) -or $artifactSize -lt 1){throw 'Invalid provenance artifact identity or size'}
        if($artifact.expired -isnot [bool] -or $artifact.expired -ne $false -or $artifact.digest -cnotmatch '^sha256:([a-f0-9]{64})$' -or
            $artifact.workflow_run.id -ne $Run.id -or $artifact.workflow_run.head_sha -cne $Sha -or
            $artifact.size_in_bytes -gt 1048576){throw 'Unverified provenance artifact metadata'}
        $digest=$artifact.digest.Substring(7)
        [byte[]]$archive=& $Download $artifact
        if($archive.Length -gt 1048576){throw 'Oversize provenance archive'}
        $hash=[Security.Cryptography.SHA256]::Create()
        try {$actual=([BitConverter]::ToString($hash.ComputeHash($archive))).Replace('-','').ToLowerInvariant()} finally {$hash.Dispose()}
        if($actual -cne $digest){throw 'Provenance archive digest mismatch'}
        $stream=New-Object IO.MemoryStream(,$archive)
        $zip=New-Object IO.Compression.ZipArchive($stream,[IO.Compression.ZipArchiveMode]::Read)
        try {
            if($zip.Entries.Count -ne 1 -or $zip.Entries[0].FullName -cne 'release-provenance.json' -or $zip.Entries[0].Length -gt 16384){throw 'Invalid provenance archive contents'}
            $reader=New-Object IO.StreamReader($zip.Entries[0].Open())
            try {$manifest=$reader.ReadToEnd() | ConvertFrom-Json} finally {$reader.Dispose()}
        } finally {$zip.Dispose();$stream.Dispose()}
        if($manifest.schema -ne 1 -or $manifest.qualified -isnot [bool] -or $manifest.qualified -ne $true -or $manifest.sourceSha -cne $Sha -or
            $manifest.lockSha256 -cne $LockHash -or $manifest.repository -cne 'YehorBabenko88/math' -or
            $manifest.workflowPath -cne $Run.path -or [string]$manifest.runId -cne [string]$Run.id -or
            [string]$manifest.runAttempt -cne [string]$Run.run_attempt -or $Contexts -cnotcontains $manifest.context -or
            $seen.ContainsKey([string]$manifest.context)){throw 'Provenance does not bind current source lockfile run attempt and context'}
        if($manifest.dependencyPolicy -cne 'math-dependency-contract/v1' -or
           $manifest.packageManifestSha256 -cnotmatch '^[a-f0-9]{64}$' -or $manifest.pythonRequirementsSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Missing validated dependency policy evidence'}
        if($DependencyEvidence -and ($manifest.packageManifestSha256 -cne $DependencyEvidence.packageManifestSha256 -or
           $manifest.pythonRequirementsSha256 -cne $DependencyEvidence.pythonRequirementsSha256 -or $LockHash -cne $DependencyEvidence.lockSha256)){throw 'Dependency source evidence mismatch'}
        $seen[[string]$manifest.context]=$true
    }
    foreach($context in $Contexts){if(!$seen.ContainsKey($context)){throw "Missing verified provenance context: $context"}}
}
