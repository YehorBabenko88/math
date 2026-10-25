# PR31 independent QA correction — 2026-10-25

Candidate exact source HEAD: `cb168925b5aeec0c957137dd94ab72c64f0bd333`.
Candidate tree claimed: `10cfd29f5d2c75e841d88dd70bef8773dada8287` (independent tree attestation still required).

## P1 finding RETRACTED
Previous Draft PR37 claimed `BOOK_QUEUE_INITIALIZING` was swallowed by the transaction catch. That was incorrect. The sentinel is created as `Error('Invalid queue state')` with `code='BOOK_QUEUE_INITIALIZING'`. The catch includes `Invalid queue state` in its allowlist and executes `throw e`, preserving object identity and `code`. The outer bounded retry loop therefore receives the sentinel. No RED reproducer supports the earlier P1. An additional explicit guard is at most an optional readability change and is **not** an acceptance fix. Do not merge that change on the basis of the withdrawn finding.

## Evidence requirements
- Check push and PR merge attempts separately; source SHA and merge SHA are not interchangeable.
- Verify source commit/tree via trusted Git objects, not candidate manifest alone.
- For Q01 require all 12 OS×Node×profile cells, plus Windows guards, terminal jobs and no mandatory skipped/failed/pending.
- Independently download every artifact ZIP, check run ID/attempt/job identity, full file inventory, JUnit/JSONL counts and SHA256 of original bytes.
- Confirm Node22/24 × PG16/18 matrix, proof kernel, Book ingestion, graph, AI policy and integration.
- Synthetic success never grants physical or production approval.

Current decision: Q01 OPEN; Integration NO-GO; Production NO-GO. No merge, deployment or physical work.

## Independently inspected Q01 ZIP — partial acceptance evidence
GitHub Actions run `40183990649`, attempt `1`, artifact `12594909670` (ubuntu-latest / Node24 / quick). Original ZIP SHA256 `0234be45f0040bcf0969a475ce065068732e0a143fb887b4f770f67e84a10708`. Manifest entries for events.jsonl, junit.xml and report.json matched raw extracted bytes. JUnit: 7 tests, 0 failures/errors/skips; report: 7 PASS; JSONL: 390 lines. Embedded source head is PR merge SHA `1b99e5c85bc8b98d0ea2552d3cf1f6dab470dd13`, embedded tree equals claimed candidate tree `10cfd29f5d2c75e841d88dd70bef8773dada8287`. This is ONE verified ZIP; the other 11 and independent Git tree resolution remain pending. No overall Q01 PASS.
