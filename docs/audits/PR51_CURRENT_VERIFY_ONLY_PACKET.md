# Current verify-only packet — not ADMINIT admission

This supersedes obsolete command examples in historical snapshots without changing them. Do not run until independent package/kit qualification and separate permission for read-only local verification. No package or executable is run by this packet. Keep outputs private; no permission changes or bypasses.

```powershell
$ExpectedHead = '<exact externally reviewed feature HEAD>'
$ExpectedTree = '<exact externally reviewed source tree>'
$ExpectedManifestSha256 = '<external SHA256 from trusted independent review>'
$Kit = 'C:\APPROVED_READONLY_NEW_FEATURE_CHECKOUT'
$Package = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MathUniverseAdminitAcceptance\approved-package'
& (Join-Path $Kit 'scripts\adminit-containment\verify-adminit.ps1') -PackageRoot $Package -ExpectedManifestSha256 $ExpectedManifestSha256 -ExpectedSourceHead $ExpectedHead -ExpectedSourceTree $ExpectedTree
```

Placeholders intentionally fail closed. Obtain expected values independently, not from the package being checked. Missing expected tree is no longer accepted by the qualified CLI/caller. This is point-in-time package identity only, not native acceptance, independent attestation or filesystem/network isolation. Execute remains unconditionally refused. No invocation of the EXE, Q01 or PostgreSQL and no writing/creating the proposed root. Historical laboratories/source trees stay untouched.
