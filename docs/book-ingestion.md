# Local Book Knowledge Ingestion

This isolated module implements `codex-book-knowledge-pipeline.md`. It changes no existing provider, browser, graph, adapter or trading module. Nothing starts automatically. Candidates remain untested scientific suggestions until explicit review; review never proves a theorem.

## Runtime and setup

Use Node.js >=22.13 (built-in SQLite) and a dedicated Python environment. Install the pinned packages in `scripts/book-ingestion-requirements.txt` there. The helper refuses pypdf <6.20.0 because older releases include a known parser security issue. Supply the dedicated Python executable explicitly; no global dependency changes are required.

The helper processes a private PDF snapshot with fixed arguments and no shell. It rejects encrypted/corrupt/oversized documents, limits page geometry, streams, output and time, and does not execute PDF actions, JavaScript or book commands. POSIX resource limits and a socket guard are defense in depth. Windows deployments still need host-level memory/network/process isolation for hostile PDFs: this module is not an operating-system sandbox.

## Explicit workflow

Create a private `scope.json`, for example:

```json
{"pages":[1,2],"allowLocalProcessing":true,"allowExternalProcessing":false,"allowExcerpts":false,"maxExcerptChars":0}
```

Rights and scope are operator assertions, not an automatic license assessment. Keep PDFs, queue files, task files, responses and backups outside Git. They may contain private book text. Commands below use placeholders for absolute private paths.

```sh
node scripts/book-ingestion.mjs enqueue --queue QUEUE --pdf BOOK.pdf --edition EDITION --version SOURCE_VERSION --license LICENSE --scope scope.json --python PYTHON --extraction-version PIPELINE_VERSION
node scripts/book-ingestion.mjs list --queue QUEUE
node scripts/book-ingestion.mjs task --queue QUEUE --job JOB_ID --python PYTHON --output task.json
node scripts/book-ingestion.mjs run-one --queue QUEUE --job JOB_ID --python PYTHON --response candidate.json --worker local-review
node scripts/book-ingestion.mjs backup --queue QUEUE --output backup.json
node scripts/book-ingestion.mjs restore --queue EMPTY_QUEUE --response backup.json
```

`task.json` includes the complete candidate JSON Schema and separates fixed instructions from untrusted `sourceData`. Give it to an authorized, tool-disabled Codex workflow and save the JSON response as `candidate.json`. The CLI itself neither calls Codex nor uploads a book. The local adapter accepts a trusted callback or response fixture. A separately injected external transport requires matching source/page authorization AND external permission in the scope. It must honor AbortSignal, idempotency keys, billing limits, and disable tools; the module cannot enforce remote-provider billing or behavior. No API credentials are stored here.

Use `extractPdfPage` / `enqueueBookPages` for optional operator-supplied printed page and normalized top-left `[x,y,width,height]` region. PDF page numbers always start at 1. A region crops the image; extracted text remains whole-page context and is explicitly labeled accordingly. Region/OCR/image/low-quality pages require visual confirmation. There is no automatic OCR, formula recognition or reliable semantic table extraction yet; the helper supplies text, images and textual figure/table references.

The extraction version must change whenever prompt, parser, validation, scope, source-version metadata or region policy changes. Deduplication intentionally uses source SHA-256, edition, page and extraction version. Conflicting duplicate payloads fail instead of overwriting previous work. Source bytes are rehashed around awaited parser operations.

## Verification and review

See [candidate contract](book-ingestion-candidate.md), [review and graph adapter](book-ingestion-review.md), and [queue repository](book-ingestion-queue.md). The runtime validator is authoritative in addition to JSON Schema: it checks source/page/text/quality pins, bounded AST structure, references, dependency cycles, SI dimensions and numeric examples. It evaluates only a fixed mathematical AST; never generated JavaScript or commands. Numerical agreement establishes only agreement with the supplied examples. Independent scientific correctness still requires review.

The excerpt guard detects normalized exact runs of 16 or more characters across candidate prose and checks the permitted total. It is a conservative heuristic, not a copyright classifier or a defense against all paraphrases/covert channels. A human must assess rights and scientific content before sharing or importing records. Review receipts are local unsigned records: filesystem access and the host application's reviewer authentication are the trust boundary.

Only reviewed candidates can produce graph patches through the injected transactional graph repository. No existing graph backend is automatically connected. Its transaction must atomically store nodes, edges and the import ledger. Claims remain `untested`; numerical evidence is scoped to examples. Receipt-file creation and recording its queue metric are separate writes; retain a written receipt for reconciliation if the latter fails.

## Recovery and PostgreSQL

The bounded SQLite pilot persists leases, fenced tokens, attempts, checkpoints, results, numeric metrics and reviews. Recovery rejects expired tokens and reuses a validated candidate checkpoint. A crash during a remote call before checkpoint persistence can repeat that call; the transport must enforce its stable idempotency key. Unknown remote costs are marked unknown, never assumed zero. Work is at least once, with idempotent completed-job and graph-import guards.

Use the async queue repository interface as the migration boundary. Export a validated snapshot, stop writers, import into an empty destination, invalidate old leases and verify counts/digests before switching. A PostgreSQL implementation should use a unique job ID, row transactions, `FOR UPDATE SKIP LOCKED`, server-time lease expiry and token-fenced updates; it must pass the same contract tests. It is not implemented or connected in this change. SQLite is limited to one host, 1,000 jobs and 8 MiB of state; no lease renewal or multi-host operation is provided.

## Tests

```sh
node --test tests/*.test.mjs
# Set BOOK_INGESTION_PYTHON to the dedicated executable to include real synthetic-PDF parsing/rendering.
```

Tests cover hostile JSON/accessors, prompt injection as inert text, source swaps, unauthorized external calls, forged metadata/quality, unsafe ASTs, dimensions/numerical contradictions, excerpt checks on resume, real writer termination, cross-process claims, stale leases, private telemetry, review gates and transactional graph imports. All PDF fixtures are synthetic. The native PDF test skips when the Python executable is not supplied; Windows symlink tests may skip without creation privileges. The dedicated `Book Ingestion Native PDF` workflow installs the pinned Python dependencies and runs the Book tests with native extraction enabled. Existing general workflows are unchanged.

### Audit hardening

Intake permissions are snapshotted before asynchronous parser work. Nested Form XObject images and inline images inside pages or Forms trigger visual review, with aggregate content, operation, depth and resource bounds. Not every PDF annotation/appearance is recognized, so host isolation and human inspection remain required. A selected region automatically requests an image. Invalid direct parser options and zero-area provenance regions fail closed.

Fresh adapter results are independently reverified by the worker, just like resumed candidates; adapter-supplied digests and reports are not trusted. Resume rejects malformed metrics, and restored checkpoint/result objects must satisfy the same individual size limits as normal writes. Changes to render policy or page count conflict with existing intake identities. Invalid explicit job IDs cannot silently acquire another job. Persisted locator objects are allowlisted and cannot override trusted extraction versions or parser options, including during task export.

The review CLI binds receipts to job identity and, where present, Book version/license and exact page/region, then recomputes the stored candidate digest. Local JSON input uses a bounded descriptor read and strict UTF-8 decoding rather than silently replacing malformed bytes. Local filesystem ownership remains trusted; these checks do not form an OS sandbox against an administrator modifying files concurrently.
