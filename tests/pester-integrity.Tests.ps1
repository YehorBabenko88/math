param([string]$ArchivePath)
$ErrorActionPreference='Stop'
$installer=Join-Path (Split-Path $PSScriptRoot -Parent) 'scripts/install-pester-verified.ps1'
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('pester-integrity-'+[guid]::NewGuid())
New-Item -ItemType Directory -Path $fixture | Out-Null
function Assert-Rejected([scriptblock]$Operation,[string]$Label) {
    $rejected=$false
    try { & $Operation | Out-Null } catch { $rejected=$true }
    if(-not $rejected){throw "Accepted unsafe fixture: $Label"}
    Write-Output "PASS reject $Label"
}
try {
    if(-not $ArchivePath){
        $ArchivePath=Join-Path $fixture 'approved.zip'
        Invoke-WebRequest 'https://www.powershellgallery.com/api/v2/package/Pester/4.10.1' -OutFile $ArchivePath
    }
    $destination=Join-Path $fixture 'installation'
    $badArchive=Join-Path $fixture 'unapproved.zip'
    [IO.File]::WriteAllText($badArchive,'Harmless unapproved archive fixture')
    Assert-Rejected { & $installer -Destination $destination -ArchivePath $badArchive } 'unapproved archive digest'
    & $installer -Destination $destination -ArchivePath $ArchivePath
    & $installer -Destination $destination -ArchivePath $ArchivePath -VerifyOnly
    $module=Join-Path $destination 'Pester/4.10.1'
    $importScript=Join-Path $fixture 'import.ps1'
    [IO.File]::WriteAllText($importScript,'param($Manifest); $ErrorActionPreference="Stop"; Import-Module $Manifest -Force -ErrorAction Stop; Write-Output "PASS clean approved import"')
    $executable=Join-Path $PSHOME 'powershell.exe'
    if($PSVersionTable.PSVersion.Major -ge 6){$executable=Join-Path $PSHOME 'pwsh.exe'}
    & $executable -NoProfile -ExecutionPolicy Bypass -File $importScript -Manifest (Join-Path $module 'Pester.psd1')
    if($LASTEXITCODE -ne 0){throw 'Clean approved Pester import failed'}
    Write-Output 'PASS clean approved installation'
    Assert-Rejected { & $installer -Destination $destination -ArchivePath $ArchivePath } 'existing destination'
    $extra=Join-Path $module 'Functions/zzHarmlessIntegrityFixture.ps1'
    $marker=Join-Path $fixture 'harmless-extra-script-executed.txt'
    $escapedMarker=$marker.Replace("'","''")
    [IO.File]::WriteAllText($extra,"[IO.File]::WriteAllText('$escapedMarker','Harmless integrity fixture executed')")
    Assert-Rejected {
        & $installer -Destination $destination -ArchivePath $ArchivePath -VerifyOnly
        & $executable -NoProfile -ExecutionPolicy Bypass -File $importScript -Manifest (Join-Path $module 'Pester.psd1')
        if($LASTEXITCODE -ne 0){throw 'Pester fixture import failed'}
    } 'extra executable Functions script before import'
    if(Test-Path -LiteralPath $marker){throw 'Unverified extra Functions script executed'}
    Write-Output 'PASS harmless extra Functions marker absent: import blocked'
    Remove-Item -LiteralPath $extra
    $file=Join-Path $module 'Pester.psm1'
    $original=[IO.File]::ReadAllBytes($file)
    [IO.File]::AppendAllText($file,"`n# harmless tampering")
    Assert-Rejected { & $installer -Destination $destination -ArchivePath $ArchivePath -VerifyOnly } 'changed approved file'
    [IO.File]::WriteAllBytes($file,$original)
    Remove-Item -LiteralPath $file
    Assert-Rejected { & $installer -Destination $destination -ArchivePath $ArchivePath -VerifyOnly } 'missing approved file'
    [IO.File]::WriteAllBytes($file,$original)
    $extraDirectory=Join-Path $module 'unexpected-empty-directory'
    New-Item -ItemType Directory -Path $extraDirectory | Out-Null
    Assert-Rejected { & $installer -Destination $destination -ArchivePath $ArchivePath -VerifyOnly } 'extra directory'
    Remove-Item -LiteralPath $extraDirectory
    $prepopulated=Join-Path $fixture 'prepopulated'
    New-Item -ItemType Directory -Path (Join-Path $prepopulated 'Pester/4.10.1/Functions') | Out-Null
    [IO.File]::WriteAllText((Join-Path $prepopulated 'Pester/4.10.1/Functions/zzFixture.ps1'),'# harmless')
    Assert-Rejected { & $installer -Destination $prepopulated -ArchivePath $ArchivePath } 'prepopulated Functions directory'
    if($env:OS -eq 'Windows_NT'){
        $junction=Join-Path $fixture 'linked-installation'
        New-Item -ItemType Junction -Path $junction -Target $destination | Out-Null
        try {
            Assert-Rejected { & $installer -Destination $junction -ArchivePath $ArchivePath -VerifyOnly } 'reparse destination'
        } finally { [IO.Directory]::Delete($junction) }
    }
    & $installer -Destination $destination -ArchivePath $ArchivePath -VerifyOnly
    Write-Output 'PASS final complete materialized composition'
} finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force
}
