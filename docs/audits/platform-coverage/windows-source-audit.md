# Windows-only source audit

Exact source: Math PR103 0b75c0a3583f9823d2b554806468fa541f20b35c. 22 identities, all original assertions retained.

| Source | Identity | Dependency / authority |
|---|---|---|
| tests/adminit-bootstrap-watchdog.test.mjs:17:1 | bootstrap deadline cleanup source and PowerShell branch MODEL mocks | Windows PowerShell + Add-Type compile; synthetic source-fragment mocks; native calls=0 |
| tests/adminit-g0-contracts.test.mjs:4:50 | G0 parse only: powershell.exe | PowerShell 5.1 / 7 parser or synthetic helpers; no G0 collection |
| tests/adminit-g0-contracts.test.mjs:4:50 | G0 parse only: pwsh.exe | PowerShell 5.1 / 7 parser or synthetic helpers; no G0 collection |
| tests/adminit-g0-csv-negative.test.mjs:2:50 | CSV complete-row SID and boundary negatives: powershell.exe | PowerShell 5.1 / 7 parser or synthetic helpers; no G0 collection |
| tests/adminit-g0-csv-negative.test.mjs:2:50 | CSV complete-row SID and boundary negatives: pwsh.exe | PowerShell 5.1 / 7 parser or synthetic helpers; no G0 collection |
| tests/adminit-g0-csv-shape.test.mjs:2:50 | physical anonymous quote-shape and canonical RFC counterpart: powershell.exe | PowerShell 5.1 / 7 parser or synthetic helpers; no G0 collection |
| tests/adminit-g0-csv-shape.test.mjs:2:50 | physical anonymous quote-shape and canonical RFC counterpart: pwsh.exe | PowerShell 5.1 / 7 parser or synthetic helpers; no G0 collection |
| tests/adminit-g0-csv.test.mjs:2:50 | 13-line CSV with one escaped quote: powershell.exe | PowerShell 5.1 / 7 parser or synthetic helpers; no G0 collection |
| tests/adminit-g0-csv.test.mjs:2:50 | 13-line CSV with one escaped quote: pwsh.exe | PowerShell 5.1 / 7 parser or synthetic helpers; no G0 collection |
| tests/adminit-g0-pure-fixtures.test.mjs:2:50 | pure G0 token/ACL fixtures: powershell.exe | PowerShell 5.1 / 7 parser or synthetic helpers; no G0 collection |
| tests/adminit-g0-pure-fixtures.test.mjs:2:50 | pure G0 token/ACL fixtures: pwsh.exe | PowerShell 5.1 / 7 parser or synthetic helpers; no G0 collection |
| tests/adminit-offline-preflight.test.mjs:26:1 | Windows Framework compile-only produces a file without loading adapter types | Windows Framework64 csc/CodeDOM + Windows PowerShell; compile-only, no adapter loading |
| tests/adminit-offline-preflight.test.mjs:27:1 | Windows parser/compiler/runtime and preloaded-type failures stay BLOCKED | Windows Framework64 csc/CodeDOM + Windows PowerShell; compile-only, no adapter loading |
| tests/adminit-offline-preflight.test.mjs:33:50 | preflight worker parser-only powershell.exe | PowerShell 5.1 / 7 parser or synthetic helpers; no G0 collection |
| tests/adminit-offline-preflight.test.mjs:33:50 | preflight worker parser-only pwsh.exe | PowerShell 5.1 / 7 parser or synthetic helpers; no G0 collection |
| tests/adminit-offline-preflight.test.mjs:35:1 | disposable hosted Windows full offline CLI and fail-closed pins/source checks | GITHUB_ACTIONS=true on Windows + Framework compiler + pinned Git/Node/PowerShell; disposable synthetic offline source; authority NONE |
| tests/adminit-token-compile.test.mjs:3:50 | Token API compile and synthetic policy only: powershell.exe | PowerShell 5.1 / 7 Add-Type; synthetic policy or FakeNative instrumentation; no live token API qualification |
| tests/adminit-token-compile.test.mjs:3:50 | Token API compile and synthetic policy only: pwsh.exe | PowerShell 5.1 / 7 Add-Type; synthetic policy or FakeNative instrumentation; no live token API qualification |
| tests/adminit-token-faults.test.mjs:3:50 | instrumented production orchestration: powershell.exe | PowerShell 5.1 / 7 Add-Type; synthetic policy or FakeNative instrumentation; no live token API qualification |
| tests/adminit-token-faults.test.mjs:3:50 | instrumented production orchestration: pwsh.exe | PowerShell 5.1 / 7 Add-Type; synthetic policy or FakeNative instrumentation; no live token API qualification |
| tests/adminit-token-flags-integration.test.mjs:2:50 | compiled AdminState flag semantics: powershell.exe | PowerShell 5.1 / 7 Add-Type; synthetic policy or FakeNative instrumentation; no live token API qualification |
| tests/adminit-token-flags-integration.test.mjs:2:50 | compiled AdminState flag semantics: pwsh.exe | PowerShell 5.1 / 7 Add-Type; synthetic policy or FakeNative instrumentation; no live token API qualification |
