# Publication note

Original source-commit results below are historical. The current local-evidence JSON is a hash-only forward-redacted derivative; original byte-exact evidence remains retained locally and in source history. It is not fresh candidate CI acceptance.

# QA evidence symlink fixture portability

Base: PR31 `cb168925b5aeec0c957137dd94ab72c64f0bd333` (tree `10cfd29f5d2c75e841d88dd70bef8773dada8287`). Scope is test fixtures only. Q01 OPEN; G1 BLOCKED; production NO-GO.

## Reproduced defect

On local Windows / Node24.20.0, the exact requested command reproduced 17PASS/2FAIL/0SKIP. Both failures were EPERM from symlinkSync. The mixed hardlink/symlink test had already executed hardlink assertions before failing; the mixed parent-symlink/path-alias test failed before executing its alias assertions. This is a fixture-availability defect, not evidence that the production validator accepted links.

## Minimal correction

- Hardlink evidence rejection and all three path-alias assertions have independent, unconditional tests.
- File symlink and directory symlink each have their own test/cleanup scope.
- Only Windows EPERM/EACCES thrown by the fixture-creation call cause that individual test to return SKIP with a BLOCKED / NOT_RUN reason.
- No catch surrounds validator assertions. Unexpected Windows failures and all Linux creation errors still fail. No automatic junction fallback or mock substitutes for native symlink rejection.
- A test-only helper seam permits deterministic classification regressions: successful creation, each permitted Windows denial, Linux permission errors, and unexpected Windows error/primitive cases. These policy tests are separate from actual symlink checks.
- `scripts/qa-evidence-manifest.mjs`, all production files, historical SQL, dependencies and existing CI gates are unchanged.

## Local evidence

| Environment / scope | PASS | FAIL | SKIP |
|---|---:|---:|---:|
| Exact base, Windows Node24.20.0, requested3files |17|2|0|
| Corrected Windows Node24.20.0, requested3files |19|0|2|
| Corrected Windows Node22.23.3, requested3files |19|0|2|
| Corrected Windows PowerShell5.1 launching Node24.20.0, requested3files |19|0|2|
| Classification policy RED before helper correction |3|2|0|
| Classification policy GREEN, Node22.23.3 |5|0|0|
| Classification policy GREEN, Node24.20.0 |5|0|0|

The two native checks are SKIP/BLOCKED, **not PASS**. Test count19→21 is due to splitting the two mixed tests, not adding a success for blocked assertions. Policy tests add five separately named synthetic unit tests. The four-file hosted lane therefore enumerates26tests:26PASS/0SKIP where both native fixtures are available, or24PASS/2SKIP when Windows denies both. No fixture-related skip is allowed by the helper on Linux.

## Hosted verification and evidence

`.github/workflows/qa-evidence-portability.yml` runs Linux/Windows ×Node22/24 with fail-fast:false and immutable Action SHAs. It runs the exact requested three files plus the five helper-policy tests. Raw TAP retains individual skip reasons; JUnit preserves skipped cases. Runtime JSON records exact checkout SHA/tree/Node/OS/run/attempt/context. Existing unmodified evidence-manifest code creates and verifies SHA256s before uploading all outcomes. A green workflow containing allowed SKIP does not prove those native assertions executed; inspect per-case TAP/JUnit and matrix counts.

Hosted jobs/results/artifact IDs are reported in the Draft PR and final engineering response after publication. Until execution they are NOT_RUN, never PASS. Existing unfiltered full-suite CI and its zero-skip Linux policy are untouched.

## Reproduce without changing machine policy

```powershell
node --test tests/q01-evidence.test.mjs tests/q01-runner.test.mjs tests/qa-evidence-manifest.test.mjs
node --test tests/qa-symlink-fixture.test.mjs
```

Do not change UAC, Developer Mode, token privileges, execution policy, system ACLs or production settings to make fixtures pass. This change does not authorize further ADMINIT/ADMIN PC activity or physical G1.
