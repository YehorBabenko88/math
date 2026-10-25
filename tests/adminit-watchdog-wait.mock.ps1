$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$helper=[IO.File]::ReadAllText((Join-Path $root 'scripts/q01-lab/WindowsJobContainment.cs'))
$fixture=[IO.File]::ReadAllText((Join-Path $root 'tests/fixtures/adminit-containment/AdminitSynthetic.cs'))
$framework=[Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$web=Join-Path ([Environment]::GetFolderPath('Windows')) 'Microsoft.NET/assembly/GAC_MSIL/System.Web.Extensions/v4.0_4.0.0.0__31bf3856ad364e35/System.Web.Extensions.dll'
Add-Type -TypeDefinition ($helper+"`n"+$fixture) -ReferencedAssemblies @((Join-Path $framework 'System.dll'),(Join-Path $framework 'System.Core.dll'),$web)
if([MathUniverse.Adminit.Synthetic]::OwnerWaitExpired(0)){throw 'Signalled wait classified as expiry'}
if(-not [MathUniverse.Adminit.Synthetic]::OwnerWaitExpired(258)){throw 'Timeout rejected'}
foreach($value in @([uint32]::MaxValue,[uint32]1,[uint32]128)){
 $rejected=$false
 try{[MathUniverse.Adminit.Synthetic]::OwnerWaitExpired($value) | Out-Null}catch{$rejected=$true}
 if(-not $rejected){throw 'Unexpected wait result accepted'}
}
Write-Output 'PASS: five pure C# wait classifications; Main not invoked; zero native calls'
