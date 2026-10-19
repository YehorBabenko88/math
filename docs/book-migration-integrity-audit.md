# Book PostgreSQL migration integrity audit

Base: `281800e142cf64f84edf58c61de0f5f862af5bc4`. Branch: `audit/book-migration-integrity`.
Scope: Book migrations and staging controls only. Historical SQL files **001–004 are unchanged**. New behavior is implemented by the Book runner and additive `005_control_integrity.sql`. Production gate stays closed; no production migration/cutover or remote publication occurred.

## Findings and changes

The initial live RED run demonstrated that changed applied SQL was silently skipped, a nonempty filename-only ledger was accepted, malformed/non-prefix history was not diagnosed as invalid, a guard generation could commit without its epoch, and a native writer with SELECT but no UPDATE on controls failed with permission denied. The first five live regressions now pass.

- **Exact source integrity:** all five files are read once before database work. SHA-256 covers exact valid UTF-8 bytes, including comments, wrappers, BOM and CRLF. Hashes are bound to the same immutable strings whose parsed bodies execute. Strict decoding rejects invalid UTF-8/lone-surrogate string sources. Nothing silently normalizes line endings. Applied files are re-read and checked on every run, even when no migration is pending.
- **Checksummed ledger:** new entries atomically store filename, raw SHA-256, `sha256-raw-utf8/v1` and applied_at in the same transaction as DDL. Validate table kind, columns/types/nullability, primary key, no ledger RLS, known filenames, ordered contiguous prefix, timestamp validity, hash format/contract and source digest. A view, nullable digest column, unknown file or gap fails closed. Access is qualified to the configured schema and the runner pins its transaction search_path to prevent TEMP-ledger shadowing.
- **Transactions/concurrency:** explicit READ COMMITTED prevents a pool's REPEATABLE READ default from retaining a stale view while waiting for the existing advisory lock. One transaction owns DDL, digest inserts, ACL changes and migration ledger creation. Concurrent runners serialize. A failed rollback preserves the original exception and discards the connection. A COMMIT acknowledgement loss is treated as uncertain, then a fresh runner verifies ledger/digests before doing any work.
- **Control privileges:** `FOR SHARE` in the previous invoker trigger required control UPDATE rights, conflicting with a minimal data writer. Migration 005 makes only the fixed, schema-pinned control-reading trigger a SECURITY DEFINER function, revokes PUBLIC access to control tables/ledger and trigger functions, and adds protected control consistency functions. The pure wire-format predicate remains invoker/public-executable because data CHECK constraints use it and it reads no privileged objects. No deployment roles, passwords, keys or grants to named app/operator roles are provisioned automatically.
- **Control integrity:** epoch → guard statement locking, increasing generations, immutable guard run/source identity, prohibited DELETE/TRUNCATE and deferred pair constraints enforce consistency at COMMIT. Legacy controllers that update/create only a guard cannot commit. New supported fencing helpers still update both rows atomically. Stale control snapshots serialize/fail instead of overwriting a newer generation.
- **Schema preflight and name resolution:** the advisory lock is explicitly resolved in `pg_catalog` before any caller-controlled search path can affect it. ACL preflight runs with catalog-only lookup and rejects any schema CREATE grant to a principal other than its owner (`BOOK_MIGRATION_SCHEMA_UNTRUSTED`). Metadata lookup stays catalog-first with a schema-qualified ledger. Only validated migration bodies temporarily use target-first lookup, required by unchanged historical DDL; catalog-first lookup is restored before recording checksums. Current ACL validation does not attest historical object ownership or authenticated execution.

## Existing filename-only ledgers: fail-closed upgrade policy

A digest calculated from today's checkout is **not evidence of SQL executed historically**. There is intentionally no `trustCurrentHashes`, boolean confirmation, filename-only adoption or fabricated operator receipt path.

`inspectBookMigrationLedger(pool)` is read-only and returns a current source manifest separately from historical rows. A nonempty filename-only ledger returns `state: legacy-unverified`, `requiresHistoricalProof: true`, `automaticAdoption: false`, `historicalExecutionAttested: false`. `applyBookMigrations` rejects it with `BOOK_MIGRATION_HISTORY_UNVERIFIED` before DDL or digest backfill, leaving the old ledger untouched. A genuinely empty filename-only ledger can add digest columns because it contains no historical claims; any pre-existing conflicting Book schema still causes atomic rollback rather than inferred adoption.

A populated legacy adoption mechanism remains **closed**, not partially authorized:

1. Preserve the original database/artifacts and verify a restorable backup in isolation; keep workers and production switching gated.
2. Recover original deployed SQL byte artifacts and externally trusted release/deployment records. Independently audit the database schema/data and migration history. Replaying current SQL in a disposable database is useful for comparison but cannot prove past execution.
3. Future adoption must bind authenticated reviewer authority and evidence to the exact target identity, schema snapshot, original file digests and run, using a real trusted approval mechanism. That mechanism is not provisioned here; no authenticated adoption API is claimed.
4. If historical evidence cannot be recovered, preserve the legacy ledger as unverified. A separately reviewed reconstruction into a fresh checksummed staging database is possible with existing explicit export/transfer workflows, but is neither performed nor automatically activated by this change.

Do **not** manually fill old rows with hashes of current files to make the runner green. Synthetic fixture helper `tests/helpers/book-migrations.mjs` is different: it actually executes known bytes and records their digest in the **same isolated test transaction**, without any claim about deployed history.

A `checksummed` report means content matches the recorded ledger. It is not a cryptographically authenticated historical-execution attestation. Database/repository owners remain trust roots.

## Permissions and compatibility

The isolated NOLOGIN/NOSUPERUSER/NOCREATEROLE test writer receives only schema USAGE, queue-table SELECT/INSERT/UPDATE/DELETE and identity-sequence usage. It receives **no control-table privileges**. Native enqueue, claim, checkpoint and complete work before fencing; enqueue rejects after fencing. Direct control SELECT/mutation, trigger disabling, direct guard-function invocation and schema object creation reject. Temporary shadow tables still cannot bypass the pinned function.

Production must explicitly provision a trusted, preferably non-login/non-superuser schema/function owner, a separate control operator and a non-owner data writer with no schema CREATE, control mutation, TRIGGER, replication-role or owner membership privileges. SECURITY DEFINER is deliberately narrow but increases the importance of trusted ownership/schema configuration. The test cluster owner is privileged; passing role probes does not prove actual deployment ownership/policies.

Migration 005 preserves existing epoch/guard identity and checks consistency on installation. Operator code that ignores 004's epoch cannot safely orchestrate after 005 and now rejects at COMMIT rather than leaving a mismatched pair. Old migration binaries can still skip their own checksum validation; require the hardened runner for migration verification. No database mechanism can make an old client authenticate bytes it never reads.

## Tests and reproducible evidence

Live regressions cover applied-byte drift; legacy rejection and read-only plans; empty-ledger bootstrap; malformed hashes/unknown entries/views/nullability; concurrent runners under an old default isolation level; connection/rollback and uncertain COMMIT behavior; incompatible controllers; stale control snapshots; TEMP-ledger shadowing; and least-privilege writer operations.

An actual migration subprocess exits before COMMIT (71) or after COMMIT (72), without normal cleanup. Before COMMIT neither schema nor ledger survives; after COMMIT all five records survive and a new runner verifies them and returns no work. This tests worker-process failure, not a PostgreSQL server/power-loss event.

The full Node 22/24 × PostgreSQL 16/18 matrix includes existing stale capability, fencing, migration parsing/function-body, snapshot, provenance, human-review, Native PDF and recovery tests. Browser E2E uses localhost. Exact final counts and commits are recorded in the delivery report; logs use `outputs/book-migration-integrity-*` and remain outside Git.

Final verification on 2026-10-19 respects the operator's request to stop new attack simulations. Existing regression files are retained, but the final matrix excludes names matching `untrusted schema CREATE|early advisory lookup|[Ii]nject|attacker|shadow|[Tt]amper|malicious|[Ff]org|symlink|hardlink|least-privilege native writer`. This is a filtered regression run, not a claim of a final unfiltered full-suite pass. Earlier RED/GREEN evidence includes local synthetic permission/name-resolution checks performed before that instruction. No access bypass, credential extraction, production operation or remote mutation was performed.

| Final local verification | Result |
| --- | --- |
| Node 22.23.3 × PostgreSQL 16.15 | 342 passed, 0 failed |
| Node 22.23.3 × PostgreSQL 18.1 | 342 passed, 0 failed |
| Node 24.20.0 × PostgreSQL 16.15 | 342 passed, 0 failed |
| Node 24.20.0 × PostgreSQL 18.1 | 342 passed, 0 failed |
| Native PDF | Enabled in all four filtered runs via `BOOK_INGESTION_PYTHON` |
| Browser E2E, localhost | 14 passed |
| `git diff --check` | Passed |

Successful final matrix logs are `outputs/book-migration-integrity-verified-node{22,24}-pg{16,18}.log`; browser log is `outputs/book-migration-integrity-final-browser.log`. The earlier `final-node*` attempts failed with `ECONNREFUSED` because the disposable servers were stopped; they were restarted locally before the successful runs. No code change was needed for that environment failure. Node's name filter omits matching tests from its total rather than reporting them as skipped; zero skipped does not mean an unfiltered run.

## Remaining limits and production blockers

- No authenticated legacy-history adoption, real operator identity-provider provisioning, global worker-process attestation or production routing switch.
- A trusted database/schema owner or superuser can alter objects, functions, ACLs or ledger records. SHA-256 detects content drift relative to the ledger; it does not authenticate a malicious first install or protect a rewritten ledger plus rewritten source.
- A matching ledger is not a full schema-drift attestation. Original runtime owner/grant settings, memberships, session defaults and pool provenance require independent deployment verification.
- Raw hashes intentionally reject EOL/BOM transformations. Use byte-stable deployment artifacts; never fix drift by silently normalizing SQL or overwriting historical digests. No old SQL is changed to force compatibility.
- Pools must return idle connections; the runner owns its transaction. Deliberately inverted arbitrary SQL/control lock orders can still provoke PostgreSQL deadlock victim selection. Supported API order is tested, and failures remain closed.
- Existing role/time/filesystem/externally anchored evidence blockers from the cutover audit remain. Production gate and scientific manual-review rules are unchanged.

Validation commands (disposable local DB only):

```powershell
$env:MATH_UNIVERSE_TEST_DATABASE_URL = 'postgres://math_test@127.0.0.1:55439/math_universe_integration' # 55440 for PG16
$env:BOOK_INGESTION_PYTHON = (Resolve-Path '../book-python/Scripts/python.exe').Path
$skip = 'untrusted schema CREATE|early advisory lookup|[Ii]nject|attacker|shadow|[Tt]amper|malicious|[Ff]org|symlink|hardlink|least-privilege native writer'
node --test --test-concurrency=4 --test-skip-pattern=$skip tests/*.test.mjs
& '../node22/node_modules/node-win-x64/bin/node.exe' --test --test-concurrency=4 --test-skip-pattern=$skip tests/*.test.mjs
node ../../outputs/run-book-migration-integrity-browser.mjs
git diff --check
```
