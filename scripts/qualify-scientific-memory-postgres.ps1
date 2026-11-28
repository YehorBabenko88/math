param([string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin')
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path $PSScriptRoot -Parent
$LabRoot = Join-Path (Split-Path $RepoRoot -Parent) ('scientific-memory-pg-' + [guid]::NewGuid().ToString('N'))
$DataRoot = Join-Path $LabRoot 'data'
New-Item -ItemType Directory -Force $LabRoot | Out-Null
function Invoke-Pg([string]$Program, [string[]]$Arguments) {
    & (Join-Path $PgBin ($Program + '.exe')) @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed: $LASTEXITCODE" }
}
$Version = & (Join-Path $PgBin 'postgres.exe') --version
if ($LASTEXITCODE -ne 0 -or $Version -notmatch 'PostgreSQL\) 18\.') { throw 'PostgreSQL18 binaries required' }
$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$Listener.Start(); $LabPort = $Listener.LocalEndpoint.Port; $Listener.Stop()
Invoke-Pg 'initdb' @('-D', $DataRoot, '-U', 'memory_lab', '--auth=trust', '--encoding=UTF8', '--no-locale')
$Started = $false
$PreviousDsn = $env:SCIENTIFIC_MEMORY_TEST_DSN
$PreviousPythonPath = $env:PYTHONPATH
try {
    Invoke-Pg 'pg_ctl' @('-D', $DataRoot, '-l', (Join-Path $LabRoot 'server.log'), '-o', "-h 127.0.0.1 -p $LabPort", '-w', 'start')
    $Started = $true
    Invoke-Pg 'createdb' @('-h', '127.0.0.1', '-p', "$LabPort", '-U', 'memory_lab', 'scientific_memory_test')
    $env:SCIENTIFIC_MEMORY_TEST_DSN = "postgresql://memory_lab@127.0.0.1:$LabPort/scientific_memory_test"
    $env:PYTHONPATH = Join-Path $RepoRoot 'python'
    & python (Join-Path $RepoRoot 'tests\scientific_memory_postgres.py')
    if ($LASTEXITCODE -ne 0) { throw 'Scientific memory live test failed' }
    Invoke-Pg 'pg_dump' @('-d', $env:SCIENTIFIC_MEMORY_TEST_DSN, '-Fc', '-f', (Join-Path $LabRoot 'memory.dump'))
    Invoke-Pg 'createdb' @('-h', '127.0.0.1', '-p', "$LabPort", '-U', 'memory_lab', 'scientific_memory_restored')
    Invoke-Pg 'pg_restore' @('-d', "postgresql://memory_lab@127.0.0.1:$LabPort/scientific_memory_restored", '--exit-on-error', (Join-Path $LabRoot 'memory.dump'))
    $RestoreProbe = @"
import os
import psycopg
source = os.environ['SCIENTIFIC_MEMORY_TEST_DSN']
with psycopg.connect(source) as a, psycopg.connect(source.replace('/scientific_memory_test', '/scientific_memory_restored')) as b:
    query = 'SELECT id,symbol,payload,stored_at FROM public.mu_scientific_runs ORDER BY id'
    assert a.execute(query).fetchall() == b.execute(query).fetchall()
    try:
        b.execute('TRUNCATE public.mu_scientific_runs')
    except psycopg.errors.ObjectNotInPrerequisiteState:
        print('backup/restore bytes and append-only trigger PASS')
    else:
        raise AssertionError('restored mutation guard absent')
"@
    $RestoreProbe | python -
    if ($LASTEXITCODE -ne 0) { throw 'Backup restore integrity test failed' }
    Invoke-Pg 'pg_ctl' @('-D', $DataRoot, '-m', 'immediate', '-w', 'stop')
    $Started = $false
    Invoke-Pg 'pg_ctl' @('-D', $DataRoot, '-l', (Join-Path $LabRoot 'server.log'), '-o', "-h 127.0.0.1 -p $LabPort", '-w', 'start')
    $Started = $true
    & python (Join-Path $RepoRoot 'tests\scientific_memory_postgres.py')
    if ($LASTEXITCODE -ne 0) { throw 'Scientific memory recovery test failed' }
    Write-Output "Native PostgreSQL qualification passed; retained disposable evidence: $LabRoot"
} finally {
    if ($Started) { Invoke-Pg 'pg_ctl' @('-D', $DataRoot, '-m', 'fast', '-w', 'stop') }
    $env:SCIENTIFIC_MEMORY_TEST_DSN = $PreviousDsn
    $env:PYTHONPATH = $PreviousPythonPath
}
