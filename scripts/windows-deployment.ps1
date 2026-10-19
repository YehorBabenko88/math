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

function Assert-DeploymentChecks {
    param([string]$Sha, [string]$Branch, [object[]]$Runs, [scriptblock]$GetJobs)
    if ($Sha -cnotmatch '^[a-f0-9]{40}$' -or [string]::IsNullOrWhiteSpace($Branch)) { throw 'Invalid deployment identity' }
    foreach ($workflow in (Get-RequiredDeploymentWorkflows)) {
        $relevant = @($Runs | Where-Object { $_.workflow_id -eq $workflow.Id -and $_.head_sha -ceq $Sha })
        foreach ($entry in $relevant) {
            foreach ($field in @('id','run_number','run_attempt')) {
                $number=0L
                if (![long]::TryParse([string]$entry.$field,[ref]$number) -or $number -lt 1) { throw "Invalid workflow metadata: $field" }
            }
            $timestamp=[DateTimeOffset]::MinValue
            if (![DateTimeOffset]::TryParse([string]$entry.updated_at,[ref]$timestamp)) { throw 'Invalid workflow update timestamp' }
        }
        # A rerun of an older run can be the newest activity. Never fall back to old green.
        $matching = @($relevant | Sort-Object -Property @{Expression={[DateTimeOffset]$_.updated_at}; Descending=$true},
            @{Expression={[long]$_.run_number}; Descending=$true}, @{Expression={[long]$_.id}; Descending=$true}, @{Expression={[long]$_.run_attempt}; Descending=$true})
        if (!$matching.Count) { throw "Missing trusted workflow: $($workflow.Path)" }
        $run = $matching[0]
        # GitHub timestamps have finite precision. A tied failed/pending attempt cannot be
        # ordered reliably against green activity, so refuse that ambiguous snapshot.
        foreach ($tied in @($matching | Where-Object { [DateTimeOffset]$_.updated_at -eq [DateTimeOffset]$run.updated_at })) {
            if ($tied.status -cne 'completed' -or $tied.conclusion -cne 'success') { throw 'Ambiguous latest workflow activity is not green' }
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
