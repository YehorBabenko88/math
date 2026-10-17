# Lossless Book PostgreSQL JSON v1

Starting point: `de94d0803844970c1076655d721f0de59e763cd0`.
Work is isolated on `feat/book-postgres-lossless-json`. No automatic cutover,
production migration, PR mutation or changes to the source branch are permitted.

## Native contract

The shared `queue-contract.mjs` validator is authoritative. Accepted values are
finite JSON numbers (with native JSON -0 normalization), booleans, null, strings,
dense ordinary arrays and plain/null-prototype objects. Native serialization is
`JSON.stringify` followed by `JSON.parse`; original formatting and object prototype
are not contractual. JSON field insertion order and UTF-16 string/key code units
survive that operation; SQLite reconstructs root job fields in column order, so
cross-backend snapshot SHA uses the existing canonical JSON definition. NUL,
lone high/low surrogates, composed/decomposed Unicode,
astral pairs and Unicode keys are valid. Undefined, executable accessors, proxies,
hooks, exotic prototypes, forbidden prototype keys, sparse arrays, symbols,
cycles and nonfinite numbers are not valid.

Global snapshot limits remain 8 MiB / 20,000 nodes / depth 24 / 1000 jobs;
individual payload/checkpoint/result/receipt limits are unchanged. Review text
rejects control characters but can contain lone surrogates. Metric names remain
ASCII and metric values are finite nonnegative numbers.

## Encoding and schema

`book-json/v1` is an exact five-field JSON envelope: schemaVersion, encoding,
byteLength, sha256, data. Encoding is `base64-utf8-json`. Native validated JSON is
serialized once; JSON.stringify escapes lone surrogates and NUL before UTF-8
conversion. Canonical base64 stores those exact bytes in ASCII. Length and SHA-256
cover those bytes, not normalized/canonical-sorted source data.

Decoder validates descriptors, version, shape, alphabet/padding and size before
allocating; checks byte length and SHA-256; uses fatal UTF-8 decoding; rejects BOM,
duplicate/noncanonical JSON and failed native bounds. Hashes detect corruption,
not forgery by a trusted database administrator. No Unicode normalization occurs.

Migration 002 adds explicit encoding-version and envelope columns. Encoding 0 is
the unchanged legacy raw jsonb format. Encoding 1 stores an authoritative envelope
plus an ASCII structural projection in the original constrained document/receipt
column. Projections contain source hash/ID/page/lifecycle/numeric metadata and
explicit `wire:v1` placeholders for free text, never misleading raw source text.
Application reads decode and compare the complete expected projection before
using any row. A `wireProjection` marker is outside the native job/receipt schema:
old readers reject projections even when user metadata happens to equal the
placeholder strings. SQL triggers forbid 1-to-0 encoding downgrades. Unknown
versions fail closed with no raw-json fallback. Mixed
legacy/v1 queues remain readable; changed/new rows use v1. Original 001 is intact.

Snapshot, deterministic ID, candidate and transfer hashes are always computed
from decoded native data. Envelope-shaped objects inside payloads are ordinary
user data; only explicit row encoding columns select decoding.

## Additional defects reproduced during independent review

* Direct Node SQLite TEXT binding replaced lone surrogates in edition,
  extractionVersion and workerId. Only these non-well-formed metadata strings
  now use a `book-sqlite-text/v1` JSON-in-BLOB frame. Ordinary legacy TEXT remains
  unchanged, including literal strings resembling the frame. Unknown/corrupt
  frames fail closed. Previously lost legacy code units cannot be reconstructed;
  ID mismatches remain errors, never guessed repairs. Older binaries reject the
  new BLOB values, so retain a verified backup and the compatible application.
* Unconditional receipt UPSERT silently upgraded unchanged legacy rows during
  reads. Writes now occur only when receipts change. Ordinal-only compaction
  preserves existing document encodings.
* Native same-clock jobs must follow SQLite `createdAt,id` order rather than
  insertion order. PostgreSQL load, ID mapping and projected transfer/head hashes
  now use that order. Arrays inside payload/checkpoint/result remain untouched.
  Legacy staging receipts based on a different queue order may require a new
  dry-run; they are not silently resigned or auto-approved.
* Concurrent initial open could see a creator's still-empty SQLite file and
  report corruption. A deterministic paused-creator subprocess test reproduced
  it. Initialization now releases the transaction and waits up to five seconds
  on its retry budget for the legitimate creator (the existing SQLite lock
  busy_timeout can add its own five seconds); an orphan empty file is never
  initialized/repaired.

## Verification evidence (2026-10-17)

Actual databases: PostgreSQL 18.1 at disposable loopback port 55439 and PostgreSQL
16.15 at port 55440, in separate local test clusters. PostgreSQL 16 portable
binaries came from the [EDB binary download page](https://www.enterprisedb.com/download-postgresql-binaries)
(Windows link fileid 1260623), with local archive SHA-256
`43bb45f173a6f08cf1d29a97a6d8deb119e8e8093a24c00d2d1001a0ccaa8281`.
No service was installed and system database/security settings were not changed.

Final test matrix and commit IDs are recorded in the external
`outputs/book-postgres-lossless-json-report.md`. Coverage includes all 65,536
UTF-16 code units, seeded Unicode key/value fuzz, native JSON bounds, near-field
limits over 500 KiB encoded jobs, malformed base64/padding/UTF-8/hash/versions,
legacy/v1 rows, immutable review receipts, duplicate enqueue, concurrent claims,
stale tokens, checkpoint/results/metrics, killed-writer recovery, repeat imports,
rollback/reapply and unchanged source hashes. No real reference books were used.

Full suite on Node 22.23.3 and 24.20.0 with each real PostgreSQL 16.15/18.1:
**304/304 per combination**, no skips/failures/cancellations; native PDF enabled.
Browser E2E: **14/14**, Chromium, retries disabled. Live tests additionally run in
simultaneous Node 22/24 processes with isolated schemas, **28/28 per runner**.

## Restore and deployment limits

Apply 002 explicitly before using this adapter; missing columns never trigger an
automatic migration. Backups and source SQLite must be retained. The schema is
forward-only while v1 rows exist: changing encoding flags or using an old reader
is not a rollback. Pre-switch rollback deletes only unchanged rows introduced by
the transfer, preserves unrelated jobs and allows a new dry-run/reapply. To return
to old software, retain/restore a verified compatible logical backup; old binaries
cannot interpret new BLOB metadata or SQL projections. Previously damaged legacy
TEXT cannot be repaired by guessing original surrogates.

Object-key ordering within the encoded native JSON is byte-stable. Root job-field
order reconstructed by SQLite is not raw-file formatting: logical snapshot hashes
use canonical JSON and queue jobs use SQLite's `createdAt,id` ordering. Caller
supplied file formatting, whitespace and prototypes are not preserved by the
existing native contract. None of these changes approves claims or sends source
material to external AI providers.

## Compatibility and operational boundaries

JSON parity requires successful codec/property tests and actual PostgreSQL 16/18
round trips. Removing the JSON blocker does not establish operator authentication,
SQLite worker quiescence or verified backups. The existing application has no
authenticated cutover controller attesting those conditions. Therefore a separate
`operator-cutover-prerequisites` blocker keeps the gate closed; plaintext phrases
and caller booleans cannot override it. No automatic backend selection is added.

## Plan and verification

1. RED codec/limits/Unicode tests, implement v1 and safe projections.
2. RED migration tests, add versioned columns without rewriting 001.
3. RED live native parity and mixed-version/corruption tests, integrate adapter.
4. Verify transfer/repeat/rollback/checkpoints/results/receipts and concurrency.
5. Independent cross-review; full Node22/24, PG16/18, PDF, Browser E2E and diff check.
6. Local commits, verified bundle and report with a separate safe publication command.
