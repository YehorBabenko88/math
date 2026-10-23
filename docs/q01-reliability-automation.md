# Q01 reliability automation

Status: Q01 OPEN. Production NO-GO. Book production gate CLOSED.

Base: 6c969ab049206c4f7f8c7348ff2148a352abd5b2. Production queue implementation is unchanged. See q01-architecture-audit.md for bounded findings and the historical probe/source binding gap.

## Execution contract

The versioned inventory in scripts/q01-lab/plan.mjs is independent of reported successes: quick (7 cases), fault (22), stress (3). Each profile runs on Linux/Windows, Node 22/24, in disposable hosted runners only. Native first-open stress runs 100, 300 and 1000 fresh pairs; each pair uses two different processes and checks one deduplicated job, one acquisition, reopen and SQLite integrity. A separate 100-pair preload diagnostic lane is explicitly distinguished from native execution.

IPC ready/start/barrier/release receipts establish interleavings. Timed holds begin after observed lock/initialization phases; elapsed time alone is not the race evidence. Crash probes cover pre/post COMMIT, DELETE/INSERT, initialization and persisted checkpoint. Whole snapshots are compared after rollback. Synthetic NUL and lone-surrogate data exercise lossless storage. Worker timeouts are 25 seconds; ordinary cases 60 seconds; high-process-count pair cases have a bounded 35-minute budget. No scenario retries conceal failures.

The test-only loader redirects only queue.mjs native imports, leaving production source unchanged. Its constructor/filesystem/statement/close receipts are diagnostic perturbations, not evidence that native timing is equivalent. Parent monotonic event order is receipt order, not cross-process clock synchronization.

## Evidence

Each run binds exact committed HEAD/tree, queue/contract/text and harness SHA256, runtime versions and pre/post tracked source identity. Output contains events.jsonl, junit.xml, report.json and SHA256 manifest.json. PASS, FAIL and BLOCKED are distinct. Missing/cancelled/unexecuted scenarios cannot qualify. The independent verifier uses the committed inventory and validates hashes, timelines, worker exits and pair counts. Hashes provide integrity, not independent attestation or immunity from a malicious same-user process.

Hosted command (the runner rejects ordinary local invocation before creating output):

```text
node scripts/q01-lab/run.mjs --source <absolute-checkout> --output <RUNNER_TEMP>/MathUniverseQ01/run --expected-head <40-hex-SHA> --profile quick
node scripts/q01-lab/verify.mjs --directory <RUNNER_TEMP>/MathUniverseQ01/run/evidence --expected-head <40-hex-SHA> --expected-profile quick
```

Artifacts contain synthetic diagnostics only: no raw SQL, payloads, lease tokens, environment secrets or working data. Non-success profiles fail CI while still uploading available evidence. Hard runner cancellation can prevent artifact completion and remains BLOCKED; it must never be represented as PASS.

## Physical Windows acceptance

See windows-q01-lab.md. PowerShell 5.1 preflight is read-only; -Execute is BLOCKED until Windows kill-on-close Job Object containment is implemented and independently verified. No physical ADMIN PC execution is authorized or performed by this change. No installation, PostgreSQL, service, deployment or production access is part of this harness.

## Remaining limits

A green synthetic matrix does not close the unexplained rare first-open failure, prove power-loss durability, validate a physical host or authorize production. Existing empty orphan rejection is an intentional fail-closed availability limit. Public error sanitization can map different native causes to Invalid queue state; native diagnostic evidence must identify a root cause before any production fix. A proven defect requires its own minimal fix branch and regression; no speculative retry/repair is introduced here.
