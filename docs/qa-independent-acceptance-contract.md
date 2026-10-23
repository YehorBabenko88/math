# Independent QA Acceptance Contract (draft)

Baseline commit: `6c969ab049206c4f7f8c7348ff2148a352abd5b2`.
Scope: QA policy only; no production authorization, migration, or physical execution.

## Decision semantics
- PASS: required assertions executed on exact source identity and independently validated evidence.
- FAIL: observed invariant violation, negative-control false acceptance, or tampered evidence.
- BLOCKED: required evidence missing, environment unsupported, mandatory job skipped, or unresolved dependency.
- NOT_RUN: execution did not occur; never count as PASS.
- SKIPPED: retain raw framework status, map mandatory skips to BLOCKED.
- GO: all required domains PASS, no unresolved P0/P1, explicit independent approval.
- NO-GO: any FAIL/BLOCKED/NOT_RUN for mandatory acceptance or unresolved P0/P1.
- Synthetic PASS must never be promoted to physical/production PASS.

## Mandatory domains and acceptance cases

| Domain | Positive cases | Negative/fault cases |
| --- | --- | --- |
| Mathematical kernel | Valid typed derivations accepted by independent verifier | forged proof, bad inference, unknown axiom, type mismatch rejected |
| Book ingestion | PDF page/source/edition/formula provenance, checkpoint resume, idempotent re-import | OCR hallucination, corrupt PDF, mismatched page hash, interrupted extraction never VERIFIED |
| Knowledge graph | typed edges, version pinning, traceable provenance, conflict handling | candidate/rejected cannot become VERIFIED through import or graph rewrite |
| SQLite queue | first-open across processes, dedup, lease fencing, restore, atomic snapshot | stale token, kill writer, busy lock, corrupt WAL/metadata, concurrent creators |
| AI adapters | isolated input/output schema, deterministic replay and resource limits | prompt injection, arbitrary book code, forged verifier receipt, status promotion |
| Integration | end-to-end source to candidate to independently checked proof | crash at each stage, replay, stale artifacts, mismatched source identity |

## Evidence contract
Every required run publishes:
1. JUnit XML: real tests/failures/errors/skipped counts, testcase IDs, durations, failure messages; reject malformed XML, duplicates and contradictions.
2. JSONL: one event per line with schemaVersion, caseId, phase, expected, actual, outcome, UTC timestamp, run identity; reject missing/duplicate final events and invalid transitions.
3. SHA256 manifest: exact digest and byte size for each evidence file, fixture and verifier input; manifest itself must be bound to trusted run artifact metadata.
4. Provenance: repository, exact 40-char sourceSha, committedTreeSha, workflow path, runId, runAttempt, jobId, OS, Node/Python/SQLite/PG versions, lockfile digest, fixture digests, random seed and invocation.
5. Evidence must be fetched from the exact trusted run/attempt and independently verified; self-reported pre/post source checks are not tamper-proof attestation.

Never accept a green workflow summary alone. Inventory all mandatory jobs and steps; cancelled, neutral, skipped, timed-out, absent, or still-running mandatory checks block qualification. A newer nonqualifying attempt cannot silently fall back to an older green run.

## Q01 dedicated gate — OPEN
Known observation: one first-open failure reported in 300 creator pairs; later passing runs do not close Q01. Existing 300/300 PASS, stale-exists BOTH_PASS, commit-race PASS, 4500/5500ms BOTH_PASS, initializing 1000ms PASS and 6500ms EXPECTED_TIMEOUT are bounded evidence, not a root-cause fix.

Required tests:
- Synchronize two and N independent creators before opening a genuinely absent database.
- Interleave file creation, BEGIN IMMEDIATE, schema creation, metadata insertion, COMMIT and read.
- Inject 0/1000/4500/5000/5500/6500ms lock holds; assert precise expected outcome and bounded latency.
- Kill creators at each transaction boundary; assert no partial metadata, no duplicate lease and no false success.
- Reopen after crash, stale lease, WAL/checkpoint and corrupt metadata; verify fail-closed or correct recovery.
- Record process PID, runtime version, start barrier, event order, database file state and redacted SQLite error codes.
- Test increasing job counts (1k, 10k, 100k) to quantify DELETE/INSERT amplification, DatabaseSync event-loop blocking, write contention and p95/p99 latency.

Do not change busy_timeout, add retries, or mark Q01 closed without a diagnosed root cause and an independent regression proving the fix.

## Fault injection and mutation
- Pre-register critical mutants for proof inference, provenance/status promotion, stale lease acceptance, artifact digest bypass, source HEAD mismatch and skipped-job acceptance.
- Every critical mutant must be killed by a specific test. Report surviving mutants individually; no aggregate mutation percentage can excuse one.
- Preserve failed attempts and raw logs. No silent rerun, weakened assertion, or replacement of failed evidence.
- Repeat clean isolated runs with pinned dependencies, deterministic seeds and independent verifier; document environmental differences.

## Gate algorithm
1. Verify source HEAD and committed tree, required workflows, run attempts and complete job inventory.
2. Validate artifact digests, JUnit, JSONL, source/fixture identities and consistency across formats.
3. Require independent negative controls, mutation and fault-injection PASS.
4. Require domain and end-to-end reproducibility PASS, and closure of unresolved acceptance blockers.
5. Require human reviewer sign-off for Integration GO.
6. Physical/Production remains a separate NOT_RUN/NO-GO gate until explicitly authorized and independently evidenced.

Current independent verdict: INTEGRATION NO-GO; PRODUCTION NO-GO; Book gate CLOSED.
