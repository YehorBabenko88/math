# Q01 SQLite queue architecture audit (read-only)

Base inspected: `6c969ab049206c4f7f8c7348ff2148a352abd5b2`. No SQLite operation or physical test was executed by this audit. Source was not edited. This report is static reasoning plus inspection of retained probe artifacts, not new runtime evidence.

## Findings and confidence

- **P1 / OPEN: fresh concurrent-open availability failure remains unexplained.** Retained `../fix-f03-r06-independent-audit-findings/outputs/remediation-f02/queue-race-probe.txt` records one failed opener at iteration 218/300 on Node 24.20.0, with the other exiting zero. Failure is `queue.mjs:75`, so the caught exception was outside the static-message allowlist at line 74. The retained probe instruments exec/prepare/get/all/run but not DatabaseSync construction, filesystem successful-stat validation, or close. It does not identify a source defect. Its 300-iteration summary differs from the current probe source loop bound 400; do not claim exact source-to-run binding without a retained digest. Confidence: high that the artifact records failure; low about mechanism. This is a blocker to declaring Q01 resolved, not proof of persisted corruption.
- **P1 / coverage gap: deterministic fresh-schema/crash boundaries are absent.** Existing `tests/book-sqlite-text.test.mjs` (concurrent opener case) delays one creator after constructor by 500ms; it does not prove both workers reached the intended interleaving, does not test pre/post schema commit process death, and gives no timeout characterization. `tests/book-ingestion-queue.test.mjs` has a two-process smoke case and a killed writer test, but the killed writer directly updates state, bypassing the API's whole-table DELETE/INSERT path. Confidence: high.
- **P2 / availability limit, intentional fail-closed behavior:** `queue.mjs:57-66,78-84` refuses to initialize an existing empty orphan. Killing the sole creator after file creation but before durable schema commit can therefore leave a directory that repeated open cannot recover automatically. A deterministic fault test should expect preserved empty orphan + rejection, rather than inventing a successful reopen requirement. No acknowledged job was present at this boundary. Confidence: high about the branch behavior; actual killed-file layout still needs hosted execution.
- **P2 / diagnostic ambiguity:** constructor/pragma/lock timeout/read/save/commit failures map to `Invalid queue state` (`queue.mjs:53-75`). An established writer held past 5000ms can produce that public result without corruption. Public sanitization is deliberate; test-only phase and native error receipts are required to separate safe busy rejection from Q01. Do not add retries that classify every such error as initialization. Confidence: high about error mapping; exact timeout latency needs runtime evidence.
- No P0 finding and no statically established job-loss or duplicate-lease defect. This is a bounded result, not a safety proof.

## Architectural checks

`BEGIN IMMEDIATE` precedes metadata inspection and document load (`queue.mjs:56-72`), so cooperating writers serialize load-modify-save; `save` deletes and reinserts all jobs inside the same transaction (36-39). A successful crash-recovery test must prove old-or-new whole snapshot, not only a final state string. `synchronous=FULL` is requested, but physical power-loss durability is not established by process kill or hosted runners.

The initializing marker is NOT stripped by catch: line 66 uses message `Invalid queue state`; line 74 rethrows the same Error, preserving `BOOK_QUEUE_INITIALIZING`. The loop only retries that marker. `existingSize` and `exists` are captured before opening/locking, so barrier cases must expose those observations and distinguish genuine creator from preexisting orphan. Static inspection alone does not prove these stale observations cause failure.

Leases use a fresh random token per acquisition; inclusive expiry recovery increments attempts only on reacquisition. Every renew/checkpoint/complete/fail validates current token and `leaseUntil > now` (`queue-contract.mjs:73-84`). Recover and fail retain checkpoints; complete clears lease and prior error. On restore all live leases are invalidated (89). Test exact-expiry races using the same injected epoch, plus stale token mutations after reissue, and assert full snapshots unchanged on rejection. Synchronized local wall clocks remain a documented assumption.

SQLite metadata identity fields use lossless TEXT/BLOB framing; payload/checkpoint/result are JSON strings (`queue.mjs:32,39`, `sqlite-text.mjs:4-15`). Malformed framing is rejected; existing codec tests cover lone surrogates and future/corrupt BLOBs. Crash tests should include a checkpoint with NUL/lone-surrogate metadata so equality checks exercise decode and identity, not merely counts.

## Required deterministic cases for the harness

1. Fresh pair: release both immediately before native constructor, record both outcomes and post-run validated snapshot; this is the unmodified-native stress profile.
2. Creator A paused after native constructor, contender B at pre-BEGIN; release A before deadline. Both opens succeed, exactly one valid metadata row, no jobs.
3. A holds BEGIN before DDL/metadata; B attempts open; release A below 5s and separately hold beyond 5s. Bounded rejection in over-timeout case must preserve A's eventual valid state.
4. Kill A after file creation / after BEGIN / after metadata insertion but before COMMIT. Distinguish intentional empty-orphan rejection from recovery of an established queue. Never silently repair metadata.
5. Kill after whole-table DELETE / after first INSERT / immediately before COMMIT on established multi-job queue. Reopen must recover exact previous snapshot and checkpoint/token/attempts.
6. Kill immediately after native COMMIT but before API acknowledgement. Reopen must reveal exact committed operation; retry enqueue must deduplicate. The lost acknowledgement is an ambiguous outcome, not a lost durable job.
7. At exact expiry race old complete/checkpoint/fail/renew against reissue; after reissue all stale mutations reject and leave new token/checkpoint/attempts intact. At final attempt no reissue occurs and failure state is stable.
8. Independent successful enqueue/acquire/checkpoint/complete from fresh workers, with exact source identities and deterministic expected cardinality. Same-process Promise.all is serialized synchronous work and does not demonstrate cross-process contention.

## Instrumentation limits

Preload hooks must call the original native method exactly once, preserve receiver/arguments/return/throw, and restrict barriers to explicit phase IDs. Save phase receipts out of queue storage. Native controls must run without preload; injected barriers intentionally change timing and only prove the scheduled interleaving. Do not infer power-loss behavior from process kill, nor user-machine evidence from disposable CI. Record Node + SQLite versions, OS, source/test digests, pair count, every nonzero result, phase arrival/release timestamps and post-failure integrity. Error receipts should contain static operation/code/phase only, never SQL, payload, document identifiers, raw paths or environment.

Existing full suite CI is Linux Node 22/24 (`.github/workflows/postgres-integration.yml:17-20,59-60`); no physical Windows Q01 acceptance follows from it. This audit does not authorize PostgreSQL execution or production access.
