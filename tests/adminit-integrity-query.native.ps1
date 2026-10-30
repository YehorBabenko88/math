$ErrorActionPreference='Stop'
# Compile and call only the application's real token assertion, never Main.
$source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'fixtures/adminit-containment/AdminitSynthetic.cs'))
$end=$source.IndexOf('  static long Created(')
if($end -lt 0){throw 'Integrity assertion boundary unavailable'}
$source=$source.Substring(0,$end).Replace(' using MathUniverse.Q01;','')+"`n }`n}"
Add-Type -TypeDefinition $source -ReferencedAssemblies System.Web.Extensions,System.Core -IgnoreWarnings -WarningAction SilentlyContinue
[MathUniverse.Adminit.Synthetic]::AssertMedium()
Write-Output 'PASS: real AssertMedium validates actual token; no fixture process launched'
