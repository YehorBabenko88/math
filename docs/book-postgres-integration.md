# Book Knowledge Ingestion / PostgreSQL integration audit

## Scope and history

The local `feat/book-postgres-integration-test` branch starts at review commit `4e4ffe36ffb8f286c7dfc8223265c2537fea0256`. Normal merge `f60cbe6749c262056d2df5efa8a8a7e65b39c28b` preserves that history and Book commit `36b2166466aba08026ad80f8417bf3578bd143e1`. Neither source branch nor main is changed. No push, credentials access, Cluster Grid connection or unattended ingestion is part of this audit.

## Common lease semantics

`mu-job-lease/v1` is a validated, detached claim representation, not a replacement store. See [record schema](book-postgres-lease-contract.md). The namespaced native job identity and opaque `claim_token` must travel together. A worker name never substitutes for an acquisition token. A normalized snapshot does not prove that a lease is still current.

| Operation | SQLite Book repository | Fenced PostgreSQL repository |
|---|---|---|
| Claim | `acquire({workerId,leaseMs,jobId?})` | `claim({workerId,leaseSeconds,jobId?})` |
| Renewal | `renew(id,token,{leaseMs})` | `renew({jobId,workerId,claimToken,leaseSeconds})` |
| Checkpoint | `checkpoint(id,token,data)` | `checkpoint({jobId,workerId,claimToken,checkpoint})` |
| Resume | Fresh claim receives committed checkpoint; Book worker re-extracts/revalidates it | Fresh claim receives committed checkpoint; registered handler revalidates its domain schema |
| Complete | `complete(id,token,{result,metrics})` | `complete({jobId,workerId,claimToken,result})` |
| Fail | `fail(id,token,{code,retryable})` | `fail({jobId,workerId,claimToken,error,retrySeconds})` |

All writes require the current token and a strictly unexpired lease. SQLite stores times in epoch milliseconds and uses its injected local clock. PostgreSQL uses database `now()` and native timestamps. At exact expiry both fenced claim paths permit recovery and reject stale writes. Renewal preserves the token and attempt count; a new acquisition creates a new token, including when the worker name is reused. PostgreSQL exhausted expired claims become failed and release owner/token/lease metadata.

Checkpoint acknowledgement means the state is committed; it does not extend the lease or approve scientific content. The generic worker exposes detached `context.checkpoint` and `context.saveCheckpoint(data)` for explicit handlers. Handlers should await checkpoint writes. The worker also drains every started write before terminal completion/failure, including early return and parallel rejection. A failed write prevents successful completion; callbacks reject after handler settlement or lease loss. Inert JSON validation precedes cloning, so accessors cannot execute or be laundered into data. Active heartbeat timers remain referenced until settlement; then timers are cleared.

## PostgreSQL migration and compatibility

Migration `004_ingestion_checkpoints.sql` adds nullable JSONB checkpoint state. Apply it explicitly before using the new fenced API; service startup still never applies migrations. The runner holds one transaction and advisory lock for all unapplied migrations. Header/footer comments no longer allow embedded script BEGIN/COMMIT to escape that transaction. Real tests verify complete DDL/ledger rollback and concurrent reapplication.

The legacy PostgreSQL enqueue/claim/renew/complete/fail API remains callable after migration. Generic worker IDs now normalize the driver's positive decimal bigint strings to safe integers before native operations. IDs beyond JavaScript's safe integer range are intentionally unsupported by the runtime methods, even though the read-only lease representation can preserve larger decimal strings.

Legacy unfenced and fenced workers must not share the same live queue. Drain legacy workers before an explicit switch. The existing standalone service continues selecting its legacy store by default; this audit does not silently change deployment behavior.

**Full Book-store substitution remains denied.** The separate PostgreSQL store still lacks a reviewed Book identity/enqueue mapping, Book review persistence, metrics/snapshot protocol and backup/restore migration adapter. Fencing plus checkpoints alone cannot authorize substitution. `assessBookQueueCompatibility` accepts the real SQLite `token` field and reports the remaining contracts without enabling a bridge.

## Provenance, rights and scientific review

Payload/checkpoint normalization preserves supplied provenance and processing scope. Generic PostgreSQL metadata is not promoted into verified source pins. The Book worker continues checking source bytes, edition/version/license, PDF/printed page, region, extraction version, text hash and quality before accepting fresh or resumed candidates. Tampering fails before an AI call or graph review.

External transport still requires both source/page authorization and the Book scope permission. Tests prove denied requests call no transport. Restored queue completion remains `review_required`; it creates no reviewer receipt. Only a separate explicit human decision permits graph import, and scientific claims remain `untested`. No test uploads source material or calls an external AI provider.

## Reproducible checks

Use Node >=22.13 and the pinned dedicated Python environment from `scripts/book-ingestion-requirements.txt`. For live PostgreSQL use only a disposable dedicated test database and an explicitly supplied `MATH_UNIVERSE_TEST_DATABASE_URL`; install the optional client with `npm install --no-save --package-lock=false pg@8.16.3`.

```sh
node --test --test-concurrency=4 tests/*.test.mjs
node --test --test-concurrency=3 tests/postgres-live.test.mjs tests/postgres-fencing-live.test.mjs tests/postgres-checkpoint-live.test.mjs
```

Set `BOOK_INGESTION_PYTHON` to the dedicated Python executable to include actual native PDF extraction/rendering. Live tests create random private schemas in the supplied test database and drop only those schemas afterward. They cannot steal each other's jobs during parallel file/process execution. The checkpoint fixture process is killed only after PostgreSQL acknowledges the write; reclamation proves the checkpoint survived and all old-token mutations reject.

On 2026-10-16, Node 22.23.3 and 24.20.0 each passed 238/238 tests, including PostgreSQL 18.1 and native PDF, with no skips or cancellations. Two simultaneous PostgreSQL test-runner processes each passed all five live tests. Chromium passed 14/14 browser tests with one worker. Initial sandbox download failures were separately reproduced with a synthetic Blob; after the user changed the execution environment, the same unchanged UI passed. No browser or OS security settings were modified.

The final run also exercises ordinary Windows DOS short-name paths (`ADMINI~1`). PDF intake canonicalizes the path and checks each ancestor for symlink/junction entries instead of rejecting aliases by string comparison. These checks do not provide an atomic filesystem sandbox against an adversarial local writer.

## Remaining qualification

- No full Book PostgreSQL migration bridge or review/snapshot backend is claimed. The substitution gate stays closed.
- Tests used PostgreSQL 18.1 on Windows. The existing CI service remains PostgreSQL 16 and has not run for these unpublished local commits; its workflow now includes the integration branch and the parallel live tests.
- Real books, OCR quality, production restart drills, reviewer authentication and host-level PDF isolation remain separate qualification tasks. Only synthetic PDFs and isolated test databases were used.
- No API keys or private book data are stored in Git. Private checkpoint/backup data requires host access controls and retention policy.
