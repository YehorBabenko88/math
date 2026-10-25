$runner = Join-Path $PSScriptRoot '../scripts/windows-q01-lab.ps1'
Describe 'Q01 Windows safety guards (no laboratory execution)' {
    It 'ships a parseable runner' {
        (Test-Path -LiteralPath $runner) | Should Be $true
    }
    if (Test-Path -LiteralPath $runner) {
        . $runner
        It 'blocks elevation before validating paths or creating files' {
            Mock Test-Q01Elevated { $true }
            { Assert-Q01Preflight -Source 'C:\missing' -ExpectedHead ('a' * 40) } | Should Throw 'elevated'
        }
        It 'rejects paths outside the literal laboratory root' {
            { Assert-Q01LabPath 'C:\Windows\Temp' } | Should Throw 'BLOCKED'
            { Assert-Q01LabPath 'C:\Users\Administrator\AppData\Local\MathUniverseLabElsewhere' } | Should Throw 'BLOCKED'
        }
        It 'rejects alias and traversal spellings' {
            { Assert-Q01LabPath 'C:\Users\Administrator\AppData\Local\MathUniverseLab\..\outside' } | Should Throw 'BLOCKED'
            { Assert-Q01LabPath '\\?\C:\Users\Administrator\AppData\Local\MathUniverseLab' } | Should Throw 'BLOCKED'
        }
        It 'blocks reparse ancestors without creating a junction' {
            Mock Get-Item { [pscustomobject]@{ Attributes = [IO.FileAttributes]::ReparsePoint; FullName = 'fixture' } }
            Mock Test-Path { $true }
            { Assert-Q01NoReparse 'C:\fixture\child' } | Should Throw 'reparse'
        }
        It 'blocks wrong HEAD' {
            Mock Test-Q01Elevated { $false }
            Mock Assert-Q01NoReparse { }
            Mock Test-Path { $true }
            Mock Invoke-Q01Git { 'b' * 40 }
            { Assert-Q01Preflight -Source 'C:\fixture' -ExpectedHead ('a' * 40) } | Should Throw 'HEAD'
        }
        It 'detects modified source snapshots' {
            { Assert-Q01Unchanged 'first' 'second' } | Should Throw 'source changed'
        }
    }
}


Describe 'Q01 execution remains blocked without native containment' {
    It 'has no process launch or filesystem mutation command in its AST' {
        $tokens = $null; $errors = $null
        $ast = [System.Management.Automation.Language.Parser]::ParseFile($runner, [ref]$tokens, [ref]$errors)
        @($errors).Count | Should Be 0
        $unsafe = @($ast.FindAll({ param($node)
            $node -is [System.Management.Automation.Language.CommandAst] -and
            $node.GetCommandName() -match '^(Start-Process|New-Item|Set-Content|Add-Content|Out-File|Set-Item|taskkill|Add-Type)$'
        }, $true))
        $unsafe.Count | Should Be 0
    }
}
Describe 'Q01 tracked source readiness boundary' {
    . $runner
    It 'requires pristine tracked source before reporting PREPARED' {
        Mock Assert-Q01Preflight { }
        Mock Assert-Q01NoReparse { }
        Mock Get-Command { [pscustomobject]@{Source='Q01FakeNode'} }
        function Q01FakeNode { $global:LASTEXITCODE=0; 'v22.23.3' }
        Mock Get-Q01SourceHash { 'f'*64 }
        Mock Get-Q01TrackedSourceIdentity { throw 'tracked source BLOCKED' }
        { Invoke-Q01WindowsLab } | Should Throw 'tracked source'
    }
    It 'rechecks tracked identity immediately before PREPARED' {
        Mock Assert-Q01Preflight { }
        Mock Assert-Q01NoReparse { }
        Mock Get-Command { [pscustomobject]@{Source='Q01FakeNode'} }
        function Q01FakeNode { $global:LASTEXITCODE=0; 'v22.23.3' }
        Mock Get-Q01SourceHash { 'f'*64 }
        $script:identityReads=0
        Mock Get-Q01TrackedSourceIdentity { $script:identityReads++; if($script:identityReads -eq 1){'a'*64}else{'b'*64} }
        { Invoke-Q01WindowsLab } | Should Throw 'source changed'
        $script:identityReads | Should Be 2
    }
    It 'permits only stable validated tracked identity' {
        Mock Assert-Q01Preflight { }
        Mock Assert-Q01NoReparse { }
        Mock Get-Command { [pscustomobject]@{Source='Q01FakeNode'} }
        function Q01FakeNode { $global:LASTEXITCODE=0; 'v22.23.3' }
        Mock Get-Q01SourceHash { 'f'*64 }
        Mock Get-Q01TrackedSourceIdentity { 'a'*64 }
        @(Invoke-Q01WindowsLab)[-1] | Should Be 0
        Assert-MockCalled Get-Q01TrackedSourceIdentity -Times 2 -Exactly -Scope It
    }
    It 'rejects preloader environment without changing it' {
        $prior=$env:NODE_OPTIONS
        try {
            $env:NODE_OPTIONS='--require=fixture-not-executed.cjs'
            { Assert-Q01SafeNodeEnvironment } | Should Throw 'preloader'
            $env:NODE_OPTIONS | Should Be '--require=fixture-not-executed.cjs'
        } finally { $env:NODE_OPTIONS=$prior }
    }
}
