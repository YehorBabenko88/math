# QA evidence audit at pinned candidate

HEAD20ede51c6e5eddbf49fde709f8af5e77a319e1c7; Node24.20.0 on current Windows host. Read-only source inspection plus tiny synthetic evidence files in a temporary directory, removed after probe. No SQLite, PostgreSQL, physical queue, deployment, remote mutation or source edit.

## Observed probes

Machine results: qa-byte-probe.json. Imported buildManifest/verifyManifest directly from scripts/qa-evidence-manifest.mjs and supplied trusted synthetic source/run/attempt/job context.

|Input|Result|Meaning|
|---|---|---|
|Malformed22-byte XML `<testsuites><notclosed`|verifyManifest true|Bytes/context match; XML validity unexamined|
|JUnit with1 testcase skipped|true|Bytes/context match; execution not qualified|
|Empty0-byte JSONL|true|Bytes/context match; event semantics unexamined|
|Manifest listing only malformed.xml, omitting all other files|true|Supplied inventory validated; no mandatory inventory is accepted by this API|
|Expected context omitted entirely|throws trusted run context required|Negative control rejects|
|Expected context empty object|throws untrusted run context|Negative control rejects|
|Expected context lacks jobId|throws untrusted run context|Negative control rejects|

These are successful BYTE INTEGRITY checks, not false qualification. buildManifest validates source SHA/run IDs, unique nonempty inventory, relative canonical paths, root/parent/file symlinks, regular single-link files,64MiB cap, descriptor identity and read stability. verifyManifest requires exact schema fields, reconstructs entries, compares byte metadata and expected identity. It does not claim JUnit/JSONL semantic validation and returns only boolean. Tests themselves deliberately use minimal `<testsuites tests="1"/>` and arbitrary `ok` byte fixtures.

The CLI manifest workflow uses trusted GITHUB_* environment plus QA_JOB_ID. It rejects missing identities. Workflow qa-q01-diagnostic.yml:47 adds `test -s` only for q01-junit.xml, so an empty JUnit is rejected by workflow shell though accepted by generic API; nonempty malformed/skipped XML is not semantically rejected by manifest verification. The test command's own nonzero exit still fails the diagnostic step/job. `if: always()` preserves manifests/uploads of failed runs; a later successful manifest step cannot turn earlier failure green. This workflow explicitly names its job Q01 synthetic diagnostic (not acceptance). It uploads JUnit and manifest only; no JSONL qualification is promised there.

## Classification

P0: none established.

P1 QA-01: Acceptance automation remains incomplete relative to docs/qa-independent-acceptance-contract.md:29-35,57-63. That draft requires semantic JUnit, event JSONL, required inventory, complete mandatory contexts and independent negative controls before GO. The small diagnostic manifest cannot implement that policy. Do not report its successful boolean or green diagnostic as acceptance. This is an unfulfilled acceptance layer / BLOCKED qualification, not a defect in the explicitly byte-oriented verifier. The separate scripts/q01-lab/verify.mjs lane has its own stronger committed inventory/event checks and must be evaluated separately; this finding does not claim it accepts these same probe files.

P2 QA-02: Pure deployment helper Assert-DeploymentProvenance permits caller-supplied empty required contexts with empty artifacts (reproduced by dot-sourcing scripts/windows-deployment.ps1, passing valid dummy SHA/lock, run{id=1,run_attempt=1}, -Contexts@(), -Artifacts@(); callback not invoked). It then validates no evidence and returns. Actual windows-update.ps1:37-42 derives nonempty contexts from the static workflow Jobs list inside Assert-DeploymentChecks, so this is latent helper precondition weakness, not a demonstrated updater bypass. With nonempty required contexts, omitted artifacts throw (source line285 and existing tests373); duplicate matching context artifacts reject (line274 and test374). A required-context set can only be complete relative to trusted caller policy.

P2 QA-03: Current release policy inventory in windows-deployment.ps1:20-28 covers five legacy workflows; it does not include q01-reliability.yml, qa-q01-diagnostic.yml, ai-orchestrator-policy.yml or proof-kernel-isolated.yml as separately mandatory jobs/provenance contexts. Full CI includes their .test.mjs tests but does not execute the separate Q01 profile matrix. Its success cannot certify Q01 hosted acceptance. This is release-policy/coverage scope to resolve before integration GO, not evidence that a mandatory listed context can be omitted.

P2 QA-04: Push plus pull_request triggers duplicate work for open same-repository PR pushes (six broad lanes plus path-filtered policy/kernel lanes); q01-reliability has12 synthetic cells plus guards/aggregate per event. No workflow concurrency key was found. PR diagnostic is path-filtered/manual only. This creates cost and potentially intentional conservative blocking: Assert-DeploymentChecks:49-76 considers all exact-head workflow activity before enforcing event=push. A newer PR/dispatch or tied nongreen run can block a prior green push. docs/pr12-integrity-remediation.md:33 explicitly documents this fail-closed choice. Do not call it false acceptance; it is an operational availability limitation. PR merge-ref SHA often differs from branch HEAD, so duplicate executions are not necessarily interchangeable provenance. No remote run count/cost measurement made.

## Release provenance guard review

scripts/verify-source-identity.mjs:6-26 allowlists five workflow paths and exact contexts; validates repository,40-character SHA,positive bounded run/attempt,workflow ref. Missing/unknown context rejects. Pre/post receipt is exclusive and outside checkout; tracked file hashes/tree/index are verified. scripts/ci-provenance.mjs:24 `qualified` means committed dependency lock/source evidence qualification, not all scientific/QA domains passed. docs/pr12-integrity-remediation.md:25-27 explicitly limits self-reported pre/post checks and same-user tampering.

windows-deployment.ps1:244-285 consumer verifies artifact identity,size,expiry,run/source metadata,archive SHA256,strict single manifest entry,source/lock/repository/workflow/run/attempt/context,duplicate contexts,tree/source evidence/dependency evidence and every requested context. Assert-DeploymentChecks separately enforces current successful exact-SHA jobs, cardinality1,run attempt,repository/path/branch and push event, latest activity with no fallback to stale green. Successful provenance alone is not proof tests executed; these checks are complementary. q01-reliability uses its separate evidence format rather than release-provenance manifests.

## Local test result and limits

`node --test tests/qa-evidence-manifest.test.mjs`:4 tests,2 PASS,2 FAIL,0 skipped. Both failures occur creating symlinks with EPERM on this host before symlink rejection assertions; hardlink checks in the third test had already executed. These two guard cases are ENVIRONMENT BLOCKED here, not evidence symlink bypass. No privilege escalation attempted. No claim the suite passes locally. Synthetic probe results are not production evidence. All temporary probe files removed.

Verdict: byte-integrity behavior confirmed within intended scope; no reproduced semantic acceptance bypass. Integration qualification remains BLOCKED pending complete policy/required contexts and independently verified evidence; physical/production remains NOT_RUN/NO-GO.
