# SQL byte reproducibility audit

Scope: generic SQL001–006 and Book001–005 only. Base: `8dd1186f3fc34fa0148eb137cb44fc2416321e7c`. Tested implementation: `327a4bbd279c55a774e97891a829b295898c41bc`; subsequent report commit changes documentation only. Final published HEAD and its five Actions runs are recorded in the delivery message.

## Findings and decision

- P0: none found in this bounded review; this is not a production audit.
- P1 (fixed): the same base commit checked out under `core.autocrlf=false` and `true` produced different raw SHA-256 values for every one of the 11 migration files. Both runners intentionally hash raw bytes using `sha256-raw-utf8/v1`; identical Git commit identity did not identify executed migration bytes.
- P2 (fixed): SQL checkout behavior had no explicit repository policy or read-only checkout-byte gate. `.gitattributes` now marks SQL `-text`, preserving blob bytes, including any future intentional CRLF blobs. `scripts/verify-sql-bytes.mjs` compares regular working files directly to exact committed HEAD blobs, fails on missing/altered files, and never rewrites files or database ledgers. Staging modified bytes cannot bless them. PostgreSQL CI and Windows contract CI run this gate; Windows also runs the LF/CRLF checkout regression.
- P2 (compatibility constraint): a previously executed CRLF checksum ledger cannot accept the LF blob checkout. Both generic and Book runners correctly fail closed. No fallback digest, normalization, backfill, historical adoption or ledger rewrite was introduced.
- P3: verifier requires Git and committed source metadata. It verifies a Git checkout, not the provenance of a detached release bundle or a database's historical execution. Runtime loaders and SQL parsers remain unchanged.

GO for review of the bounded source change. NO-GO for automatic use against existing ledgers with incompatible historical bytes or unknown execution provenance. No deployment/cutover/migration against an external or production database was performed.

## RED and GREEN evidence

Outside-Git evidence directory: `outputs/sql-byte-reproducibility/` in the parent workspace. `red-two-checkouts.json` records two isolated shared clones checked out at the exact base tree with settings false/true and no attributes inherited from the patched worktree, all 11 raw hashes and lengths. `red-base-byte-differences.json` additionally records original Windows checkout versus Git blobs. `red-regression.txt` records the new regression failing before policy/verifier existed.

All 11 base blobs are LF. For example SQL001 is 707 bytes / SHA-256 `f04c234b7a7cd78f6e42e3af8ae1cbd770e14c3e9748f25823885102e0f41c32` under LF; its CRLF checkout differs. The isolated branch worktree was physically rematerialized from existing HEAD blob bytes to test the new policy. This changed checkout bytes only: all historical SQL Git blobs and SQL text remain unchanged (`git diff 8dd1186 -- sql` empty). No applied SQL was normalized and no historical ledger was edited.

Regression creates a disposable Git repository, commits both an LF generic fixture and a CRLF Book fixture, checks both remain byte-identical under both autocrlf settings, runs the verifier, then proves changed and staged-changed SQL fail. New real PostgreSQL regressions execute exact synthetic CRLF inputs, capture ledgers, reject LF apply and inspect, assert ledger equality, and confirm exact original CRLF source remains idempotent for both runners. Existing filename-only history rejection remains covered.

Windows local full unfiltered suites: Node22/24 x PostgreSQL16.15/18.1, each successful result 412 passed, zero skipped/todo. The Node24/PG18 full rerun passed 412/412 in 21.337 seconds. The first Node24/PG18 run had 411 pass / 1 failure in the existing protocol-row lease witness timeout (`postgres-lease-clock-live.test.mjs:65`); retained as a limitation and rerun evidence, not silently discarded. All four pending backend PIDs were active waiting on Lock, with two pairs of blockers, and every lease validity flag was false. The log does not identify the exact lock subtype or blocker statement; deadline consumption during setup/contention is a hypothesis, not an established root cause. Browser synthetic fixtures: 14 passed. Full suites include native PDF and migration integrity tests. Linux evidence comes from the four remote PostgreSQL Actions matrix cells; final status is recorded in the delivery message. Windows PowerShell deployment fixtures are independently covered by Windows Actions.

## Operator compatibility plan (documentation only)

1. Before adopting a new checkout policy for an existing database, retain a read-only export of its migration ledger and independently proven original executed artifact bytes; record raw SHA-256, contract and provenance. Current source bytes do not establish historical execution.
2. Compare each ledger entry with the proven original bytes. Missing provenance, filename-only histories, non-prefix entries or unknown checksums require a separate reviewed recovery decision. Do not backfill them from this checkout.
3. If a checksummed ledger corresponds to original CRLF artifacts, retain and use that proven artifact for compatibility under the existing raw contract, or design a separately reviewed migration/recovery path. This branch offers no automatic conversion or adoption command.
4. Fresh verified Git checkouts use committed blob bytes; run `node scripts/verify-sql-bytes.mjs` before packaging or opting into migration. On mismatch, investigate artifact provenance and checkout settings; the verifier deliberately does not repair the checkout.

Limitations: synthetic disposable databases establish bounded runner behavior; no production history, production service, Bookgate or ClusterGrid behavior was inspected. Existing lease witness timing failure is unrelated source code but remains part of the local evidence. Passing CI does not attest historical deployment bytes or authorize deployment.
