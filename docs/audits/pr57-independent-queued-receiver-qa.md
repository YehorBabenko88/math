# Independent GPT-6 audit — PR57 queued inventory, receiver and evidence privacy

Observation: 2026-10-25, read-only GitHub API. Source PR57 HEAD `d18a95d2a0936c35d1c0d74febeb4b05d25f4366`; Git tree `2f598f6ead0707bbcc626b9800876514bc9b645b`. Original PR57 is unchanged.

## Inventory audit and risk boundary

Parsed the original 2,012,806-byte JSON snapshot (not just proposal prose). Exactly 1,878 distinct run IDs, all observed queued in the non-atomic 15:42:42–15:45:07 UTC snapshot; 18 workflows, 1,033 distinct HEAD/workflow sources, zero recorded retrieval errors. The classifications total 370 HEAD raw-publication-risk, 1,498 other workflow/no targeted raw-path match, 10 digest/redacted variants. Candidate split: 335 Q01, 35 ADMINIT; 195 push, 175 pull_request. All 175 PR candidates have `executionRevision=UNRESOLVED_PR_MERGE_WORKFLOW`. No candidate is approved for cancellation merely by appearing here.

**Important independently observed counterexample to cancellation-by-queued-status:** run https://github.com/YehorBabenko88/math/actions/runs/40183964438 remains workflow queued, yet 13 of 14 jobs completed SUCCESS, 12 artifacts were published, and only the coverage aggregator is queued. PR run https://github.com/YehorBabenko88/math/actions/runs/40184384450 has the same 13-success/1-queued shape with 12 artifacts. Therefore workflow queued is NOT equivalent to unstarted and must not imply safe cancellation or absence of prior publication.

The live spot-check also found run 40184389853 still queued with 12 artifacts, while PR57 receiver run 40211216019 is queued with four unassigned jobs and no artifacts. These are bounded samples, not a fresh census of all 1,878 current statuses.

Before any separately authorized targeted cancellation, independently re-fetch current run status, attempt, all job pages and conclusions, artifact inventory, executed workflow revision/PR merge SHA and current source; preserve existing evidence; obtain explicit operator approval. Do not cancel, rerun or dispatch based on the old snapshot.

## Independent receiver review

Source: `src/evidence-receiver/{receiver,oidc,bundle,journal,seal,zip,strict}.mjs`. The library enforces sealed RSA-OAEP/AES-GCM courier, Ed25519 pending-review receipt, signed OIDC `check_run_id` matched against job/attempt API inventory, source/tree/package pins, bounded STORE ZIP and SQLite replay journal. The published workflow runs synthetic tests only, `contents: read` and no `id-token: write` or transport. No real collector, keys, custody or private evidence transport configured. Receiver G0 confidential operational acceptance BLOCKED. Source review is not runtime attestation.

**Preservation gap:** `receive()` stores encrypted original envelope and an encrypted capture of provider platform/JWKS responses, but no independent evidence that full hosted native raw files and logs were ever collected or delivered. The private receiver protocol is a proposed exact seven-member bundle, not evidence that the producer assembled it. A digest-only public projection cannot substitute for retained original bytes and private reviewer access. Require explicit private retention manifest, immutable custody/retention, reviewer separation, capture of stdout/stderr where authorized, independent original ZIP SHA256 and proof that no mandatory source file was omitted. Do not publish raw SIDs, paths, credentials, access tokens, OIDC JWTs, stack traces or base64-encoded equivalents.

## Sample artifact privacy/integrity

Downloaded original Q01 quick ZIP artifact ID `12596390408` from run `40183964438`, attempt 1. ZIP SHA256 `7e30a75dcfa720cb0f0a62939e04bb7f8bbbcfbc94cb79129719df304c9f7448`. Exact four members `events.jsonl`, `junit.xml`, `manifest.json`, `report.json`; SHA256 for all three manifest-listed members matched original bytes. A bounded scan found zero Windows drive-path and SID regex hits in this one ZIP. **Not a global privacy PASS:** scan is limited, encoded/binary/nested content may escape it, and no GitHub console logs or other ZIPs were exhaustively reviewed.

## Unauthorized broad test process deviation

PR57 explicitly reports an accidental `npm test` during concurrent dirty-tree development: 910 total, 794 PASS, 9 FAIL, 107 SKIP, including synthetic Q01 20-pair default. The 8 detached-journal assertion failures and 1 then-incomplete bootstrap-model failure are not evidence of candidate-head regressions without exact-base reproduction. Preserve private raw log SHA256 `ab980bd995b0ecbf4829904452e3985f616242eb0356b6c909fa0cec1828c6ec`, execution environment/command and dirty worktree provenance; mark broad run `NONQUALIFYING_PROCESS_DEVIATION`. Do not silently drop failures or repeat the full suite without authorization. Scope-limited test selection and command allowlisting should be enforced by CI/test orchestration.

## Decision

- P1: cancellation-by-queued-status would be unsafe; two concrete runs prove already-completed jobs and artifacts while aggregator is queued. No cancellation authorized.
- P1: 175 PR merge revisions unresolved; candidate classification is a risk hypothesis, not executed revision proof.
- P1: receiver transport/custody and independent original evidence retention remain unqualified; operational confidential acceptance BLOCKED.
- P1 process: accidental unscoped `npm test` (9 FAIL, 107 SKIP) cannot qualify PR57.
- P2: one sampled Q01 ZIP has internally consistent SHA256; limited regex scan is not a privacy certificate.
- P2: CI source contracts require hosted exact-head results; PR57 jobs are queued in the observed snapshot.

G0 confidential operational NO-GO; G1 CLOSED; Q01 OPEN; Production NO-GO. No cancellation, rerun, merge, deployment, production database or physical operations.

## Recheck and CI coverage follow-up

Live read-only recheck of runs 40183964438, 40184384450 and 40184389853: each workflow remains `queued`, each has 13 completed SUCCESS jobs, one queued coverage aggregator and 12 artifacts. Receiver run 40211216019 remains queued with four unassigned jobs, zero completed jobs and zero artifacts. This demonstrates two different queue states and does not imply that any one run is safe to cancel. The inventory regression suite is now wired to the receiver contract workflow on Windows/Linux Node22/24. CI execution on this audit HEAD remains unverified; no reruns or cancellations were requested.

## 2026-10-25 further exact-head receiver CI observation

At audit HEAD `823d12d485e8378d09e9a344b771381e303cc951`, eight workflows were QUEUED. Receiver run https://github.com/YehorBabenko88/math/actions/runs/40212958870 exposed all four Windows/Linux × Node22/24 jobs as QUEUED, `runner_id=0`, zero steps and zero artifacts. This is runner non-assignment, not evidence of receiver test failure or success. The underlying scheduling cause remains unknown. Added negative inventory tests to prevent accidental promotion of 175 unresolved PR merge candidates into verified cancellation decisions. No rerun/cancellation.
