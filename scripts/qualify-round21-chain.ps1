param([string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin')
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path $PSScriptRoot -Parent
$LabRoot = Join-Path (Split-Path $RepoRoot -Parent) ('round21-chain-pg-' + [guid]::NewGuid().ToString('N'))
$DataRoot = Join-Path $LabRoot 'data'
$Version = & (Join-Path $PgBin 'postgres.exe') --version
if ($LASTEXITCODE -ne 0 -or $Version -notmatch 'PostgreSQL\) 18\.') { throw 'PostgreSQL18 required' }
New-Item -ItemType Directory $LabRoot | Out-Null
function Invoke-Pg([string]$Program, [string[]]$Arguments) {
    & (Join-Path $PgBin ($Program + '.exe')) @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed: $LASTEXITCODE" }
}
$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$Listener.Start(); $LabPort = $Listener.LocalEndpoint.Port; $Listener.Stop()
Invoke-Pg 'initdb' @('-D', $DataRoot, '-U', 'memory_lab', '--auth=trust', '--encoding=UTF8', '--no-locale')
$Names = @('ROUND21_CHAIN_LIVE', 'SCIENTIFIC_MEMORY_TEST_DSN', 'MATH_EXPERIMENT_OWNER_URL', 'MATH_EXPERIMENT_HOST_URL')
$Saved = @{}
foreach ($Name in $Names) { $Saved[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process') }
$Started = $false
$PreviousLocation = Get-Location
try {
    Invoke-Pg 'pg_ctl' @('-D', $DataRoot, '-l', (Join-Path $LabRoot 'server.log'), '-o', "-h 127.0.0.1 -p $LabPort", '-w', 'start')
    $Started = $true
    Invoke-Pg 'createdb' @('-h', '127.0.0.1', '-p', "$LabPort", '-U', 'memory_lab', 'scientific_memory_test')
    Invoke-Pg 'psql' @('-h', '127.0.0.1', '-p', "$LabPort", '-U', 'memory_lab', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE ROLE math_experiment_owner LOGIN; CREATE ROLE math_experiment_host LOGIN;')
    Invoke-Pg 'createdb' @('-h', '127.0.0.1', '-p', "$LabPort", '-U', 'memory_lab', '-O', 'math_experiment_owner', 'math_experiment_test')
    $env:ROUND21_CHAIN_LIVE = '1'
    $env:SCIENTIFIC_MEMORY_TEST_DSN = "postgresql://memory_lab@127.0.0.1:$LabPort/scientific_memory_test"
    $env:MATH_EXPERIMENT_OWNER_URL = "postgresql://math_experiment_owner@127.0.0.1:$LabPort/math_experiment_test"
    $env:MATH_EXPERIMENT_HOST_URL = "postgresql://math_experiment_host@127.0.0.1:$LabPort/math_experiment_test"
    Set-Location $RepoRoot
    & node --test --test-timeout=60000 tests/round21-chain-live.test.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Round21 component chain failed' }
    Write-Output "Synthetic pinned component chain passed; retained evidence: $LabRoot"
} finally {
    Set-Location $PreviousLocation
    if ($Started) { Invoke-Pg 'pg_ctl' @('-D', $DataRoot, '-m', 'fast', '-w', 'stop') }
    foreach ($Name in $Names) { [Environment]::SetEnvironmentVariable($Name, $Saved[$Name], 'Process') }
}
