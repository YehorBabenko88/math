# Book Cutover Controller — independent security/concurrency audit

Date: 2026-10-18. Base: `8e19d00df3767ce6436e3d570b7a6fc661893c36`.
Branch: `audit/book-cutover-hardening`. Production gate remains **CLOSED**. No production cutover, production migration, remote publication, merge or application routing change was performed.

## Confirmed defects and fixes

All runtime defects below were reproduced by a failing regression before their fix. PostgreSQL bypasses were also rechecked against the exact baseline implementation: all three bypass tests failed with successful unauthorized mutations, then passed with hardening restored.

| ID | Severity within the rehearsal contract | Reproduction / root cause | Minimal fix |
| --- | --- | --- | --- |
| F1 | P1 — post-fence write | A supported queue writer or SQL transaction carrying a pre-fence REPEATABLE READ snapshot could not see the newly inserted guard and committed a job mutation after the first fence. Locking an unchanged metadata row did not invalidate that snapshot. | New migration 004 creates a permanent epoch singleton. Every mutation trigger takes its shared lock; fence takes an exclusive lock and changes its row version atomically with the guard. Old snapshots serialize or fail. |
| F2 | P1 — SQL guard bypass | Ordinary TEMP tables named like the guard/epoch shadowed unqualified table references in the trigger function. A schema-qualified DELETE of actual jobs succeeded after freeze without a capability. | Migration 004 pins the trigger function search_path to pg_catalog, the trusted installation schema, then pg_temp. Migration 003 is unchanged. |
| F3 | P2 — observed session expiry reversed | A signed session rejected at expiry was accepted again by the same verifier after its clock moved backwards. | The verifier rejects time below its observed high-water mark, including time observed during an expiry rejection. This is per-verifier protection, not an authenticated time service. |
| F4 | P2 — expired owner resurrected | An owner rejected at lease expiry could commit after the same journal clock moved backwards, without a new claim. | Journal mutations enforce a process-local time high-water mark and seed it from persisted event timestamps on reopen. See the restart/time limitations below. |
| F5 | P2 — journal becomes unreadable after successful commit | Evidence fitted the input/visible limits, but the enclosing event exceeded the reader's 262144-byte JSON limit. A successful commit could brick subsequent reads. | Validate the complete event using the reader's exact JSON contract before INSERT; an oversized event rolls back and leaves the run readable. |
| F6 | P2 — orphan storage silently initialized | An existing SQLite file missing cutover_events was treated as a new journal and silently modified by CREATE TABLE IF NOT EXISTS. | Only an exclusive wx creator may initialize a new file. Existing missing-schema/zero-byte files fail closed; interrupted bootstrap is not auto-repaired. Constructor failures close their DB handles. |
| F7 | P2 — storage checks only at open | Adding a hardlink to an already open journal did not prevent further reads or claims despite the advertised single-link storage contract. | Recheck canonical directory, main/sidecar file types, link counts and sizes on operations; require the main file identity to match the opened file. |
| F8 | P2 — ambiguous backup image accepted | Verification accepted a nominal single-file backup accompanied by WAL, SHM or rollback-journal artifacts. Restore copied only the main image, so its witness did not cover the full SQLite artifact set a normal opener could consume. | A standalone backup rejects all sidecars before restore and after verification. Static hardlinks and redirected directories are also regression-tested. |
| F9 | P2 — frozen WAL reads/reopen fail | Native queue access unconditionally requested journal_mode=DELETE, including frozen reads. An existing WAL reader caused a supported list to fail; without that reader it could persistently change an existing frozen database's journal mode. | Preserve the existing SQLite journal mode; new SQLite files retain SQLite's default DELETE mode and synchronous FULL remains enforced. WAL freeze/backup/old-worker tests pass. |
| F10 | P2 — wrong-scope caller can fail next stage | State changed between status and claim. The caller authorized for the old scope claimed the next state, failed reauthorization and wrote FAILED, consuming a generation in a stage it could not operate. | Controller passes expectedState into the journal claim. BEGIN IMMEDIATE checks state and ownership atomically; stale observations reject before claim/event changes. Post-claim and post-effect authorization remain in place. |
| F11 | P2 — total journal capacity crossed after successful append | Repeated valid expired claims retained a large bounded evidence snapshot. A successful append/checkpoint grew storage beyond the 32 MiB physical limit; status/reopen then failed. The independent reviewer reproduced this using supported APIs only. | Check total encoded-chain capacity (8 MiB including a per-row allowance) and 10000-event cap atomically before INSERT, leaving physical overhead reserve. Exhaustion rejects new events while preserving readable state; no implicit archive or history deletion. |

P1 here describes a violated staging writer-fencing invariant, not an assertion that production was enabled. Production remained blocked before and after this audit.

## Reviewed components and invariants

- **Controller:** explicit rehearsal-only construction; scoped signed authorization before effects and again before publishing evidence; expected-state claim CAS; source/target/backup rechecks before READY and simulated ACTIVATED; no startup activation, no backend switch, no promotion to proven.
- **SQLite source:** BEGIN EXCLUSIVE serializes with active writers. Tests keep a WAL reader's old snapshot open and verify that it cannot upgrade after freeze. A separate old process holds an in-flight WAL write; freeze waits, includes that committed write, and rejects that same process's next mutation. Native no-op enqueue, claim, renew and complete remain blocked after freeze/reopen. No proof of global OS process termination is inferred from job counts.
- **PostgreSQL:** shared/exclusive epoch → guard → metadata lock order for supported writer/fence operations. Epoch and guard generation are checked together and updated within one transaction. Tests cover stale capabilities, concurrent rotations, writers, rollback, connection failure and a COMMIT acknowledged by the server but followed by a simulated client-side error. An uncertain commit remains fenced; only a new generation may rotate it. Ordinary SQL must not deliberately invert control locks or alter the control schema.
- **Migration 003/004:** 001–003 are byte-for-byte unchanged. 004 upgrades an existing generation-7 guard to a matching epoch without changing its identity, then generation 8 rotates normally. Reapplication through the runner returns no work; concurrent migration and rollback tests pass. The existing Book runner uses a filename ledger/advisory lock, **not stored content checksums**. This corrects an overstatement in the earlier report.
- **Operator sessions:** Ed25519 signature verification, issuer/audience, scope, run/resource, bounded TTL, inert JSON and expiry are tested. Reusing a valid scoped session within its TTL is intentional; it is not a one-use activation token. Claims/generations make stage execution exclusive. Changed bindings, signatures and wrong scopes are rejected. No real credentials or identity-provider sessions are used in tests.
- **Journal:** FULL synchronous WAL, hash chain, bounded readable events and total chain capacity, stale-owner rejection, expected-state CAS, live lease exclusivity and restart persistence. A subprocess exits with code 71 immediately after a durable claim and source freeze, before committing the transition or closing the journal; restart reclaims generation 2 and reruns PREPARE checks rather than skipping them.
- **Backup:** integrity check, physical SHA-256, independent physical/logical restore and source snapshot matching. Tests cover partial/corrupt artifacts, post-VERIFY replacement/corruption, hardlinks, a redirected directory, sidecars and WAL source restoration. Backup failure never thaws either store.
- **Scientific safety:** existing full-suite tests retain provenance, receipts, human review and external-AI source/page consent restrictions. These modules and the production compatibility gate are not relaxed.

## Remaining production blockers / limits

1. Trusted operator key provisioning, real identity-provider authentication, revocation and operator policy are not installed. Injected public-key verifiers and synthetic signatures are not deployment authority.
2. There is no authenticated time service. The session high-water mark is per verifier; the journal persists committed event times only. A complete restart plus clock rollback, including observations from rejected operations that were never committed, is not proved safe by these local guards. Persisted event time cannot establish real elapsed time during downtime.
3. Worker OS process shutdown, deployment attestation and production routing are absent. Storage fencing is not global process supervision. No production switch is implemented.
4. Database role isolation remains required. An owner/admin can disable triggers or edit the epoch/guard schema; arbitrary DDL/control-table writes are outside supported queue operations. Pool schema configuration and the installed schema are trusted. Target database/schema/port identity is staging identity, not authenticated production TLS identity.
5. Filesystem path/link checks detect tested static substitutions and identity changes, but do not eliminate arbitrary concurrent privileged filesystem replacement races. The journal hash chain is not externally anchored and does not prove integrity against a privileged owner who can rewrite or truncate an entire valid chain. Damaged/interrupted bootstrap and finite-capacity exhaustion require explicit operator recovery; there is no automatic compaction or archive.
6. SQL lock timeouts and interruption policy belong to the injected pool/deployment. Deliberately inverted arbitrary SQL lock orders can still cause PostgreSQL to abort a participant. Supported queue/fence concurrency is tested; no unbounded universal deadlock-freedom claim is made.
7. Lease expiry rejects stale journal publication; PostgreSQL capability revocation occurs when a successor rotates the guard and waits for in-flight transactions. This is not an atomic distributed lease or production cutover protocol. Production power-loss/disk/controller failure on actual deployment hardware is not tested.
8. Migration 004 is required by hardened fencing helpers. Apply it explicitly in controlled staging; old controller binaries do not maintain its epoch and must not orchestrate cutover afterward. Queue backend substitution and automatic production migration remain disabled.

## Validation evidence

Final matrix and local commit identifiers are recorded in the delivery report. Runs use Node 22.23.3/24.20.0 and PostgreSQL 16.15/18.1, synthetic queues and isolated UUID schemas in disposable local databases. Native PDF uses the local pypdf/pypdfium2 runtime; Browser E2E serves only localhost.

Final validation (2026-10-18):

| Node | PostgreSQL | Full suite | Skipped |
| --- | --- | --- | --- |
| 22.23.3 | 16.15 | 349/349 passed | 0 |
| 22.23.3 | 18.1 | 349/349 passed | 0 |
| 24.20.0 | 16.15 | 349/349 passed | 0 |
| 24.20.0 | 18.1 | 349/349 passed | 0 |

All four suites ran concurrently with per-suite concurrency 4 and isolated schemas. Native PDF is included in each full run. Browser E2E: **14/14 passed**. Whitespace checks passed. An additional read-only reviewer found F11; its capacity fix was independently checked with journal tests **9/9 passed**, with no other important findings in the hardening patch.

Commands:

```powershell
$env:MATH_UNIVERSE_TEST_DATABASE_URL = 'postgres://math_test@127.0.0.1:55439/math_universe_integration' # 55440 for PG16
$env:BOOK_INGESTION_PYTHON = (Resolve-Path '../book-python/Scripts/python.exe').Path
node --test --test-concurrency=4 tests/*.test.mjs
& '../node22/node_modules/node-win-x64/bin/node.exe' --test --test-concurrency=4 tests/*.test.mjs
node ../../outputs/run-book-hardening-browser.mjs
git diff --check
git diff --cached --check
```

RED and GREEN logs are outside Git under `../../outputs/book-hardening-*.log`. No passwords, real tokens, session credentials or private keys are persisted in Git/logs. Tests generate ephemeral keys; crash-worker arguments contain only synthetic hashes, paths and run identifiers.
