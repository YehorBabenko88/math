# GPT-6 independent hosted acceptance — PR #60
Review date: 2026-10-26. **No merge/deployment/ADMINIT/production access.**

## Source and workflow identity
PR #60 original head `b24d2d6ca264926c1a65a96f574057192bfeca03`, Git object tree `2d9779913c4a0e127629e55debf53d3e53a9892b`, base head `d18a95d2a0936c35d1c0d74febeb4b05d25f4366`. API PR merge SHA `7a7c43ddd2edee18cb12515bfd96a101e1516555`. Distinguish PR merge SHA from API run/job head SHA; executed checkout tree and actual OIDC `sha` remain unproven until verified on the runner with trustworthy evidence.

Receiver [run 40298775250](https://github.com/YehorBabenko88/math/actions/runs/40298775250): `pull_request`, attempt 1, run status `completed/success`, API run head `b24d2d6ca264926c1a65a96f574057192bfeca03`, 4/4 completed success jobs. Actual GitHub runner IDs, all setup/checkout/test/cleanup steps SUCCESS. Original logs independently inspected:

| Platform | Job ID | Node TAP PASS | FAIL | SKIP | Reason |
| --- | ---: | ---: | ---: | ---: | --- |
| Windows / Node 22 | 121491235562 | 103 | 0 | 0 | All model tests |
| Windows / Node 24 | 121491235797 | 103 | 0 | 0 | All model tests |
| Linux / Node 22 | 121491235847 | 102 | 0 | 1 | Windows PowerShell model compilation requires Windows |
| Linux / Node 24 | 121491235829 | 102 | 0 | 1 | Platform-only model skip |

Total: **410 PASS, 0 FAIL, 2 SKIP** of 412 test identities. Linux skip is never treated as a PASS. These are synthetic keys/isolated receiver tests, **not live OIDC, native, or physical**.

## Logs, privacy and artifacts
Downloaded and inspected all four GitHub job logs. Scan for private key PEM, JWT shape, GitHub token prefixes, SID account strings, and stack traces found no matching visible sensitive payload; GitHub masks checkout token as `***`. Hosted runner paths and deprecation warnings appear. Regex absence does not prove absence of all sensitive/encoded/hidden data. Run artifact API reported **0 artifacts**; therefore no original ZIP and no uploaded JUnit/JSON to bind to attempt. `id-token: write` permission is not enabled, no real collector/keys/transport. Operational confidential receipt not demonstrated.

## Independent integration blockers
At exact PR #60 source head, [PostgreSQL Integration run 40298775080](https://github.com/YehorBabenko88/math/actions/runs/40298775080) is `completed/failure`: all four Node22/24 × PostgreSQL16/18 jobs fail `Full unfiltered suite`, provenance steps are skipped, and full CI coverage job fails. Node22/PostgreSQL16 logfile explicitly shows 8 Q01 detached-journal phase-2 failures, actual `Invalid queue state` vs expected `Invalid queue directory` (at test paths line 15 onwards), **not** proof of unsafe acceptance: test fixtures assert `ok=false`. Node22/PG16 summary: 980 tests, 971 PASS, 8 FAIL, 1 SKIP. Independently reproduce/fix the precise error-boundary semantics before claiming acceptance; no broad rerun was requested.

[Q01 Queue Reliability run 40298775089](https://github.com/YehorBabenko88/math/actions/runs/40298775089) has 12 scenario matrix jobs, one Windows guard, and coverage aggregator completed SUCCESS. It publishes 12 run-scoped artifacts named with PR merge SHA `7a7c43ddd2edee18cb12515bfd96a101e1516555`; original ZIP byte verification not yet performed in this audit. The distinct SHA relationship must not be interpreted as a mismatch without independently resolving commit/tree.

## Historical queue and cancellation
A current REST `status=queued` repository query returned 48–57 rapidly changing queued workflows during repeated reads. This is an active, non-atomic count, **not 1,878 still queued**. Previously sampled runs `40183964438` and `40184384450` are now `completed/success`, attempt 1; they previously had already-published artifacts while aggregator was QUEUED. Original 1,878 snapshot/370 risk candidates/175 unresolved PR merge revisions are historical hypotheses; no fresh per-candidate 370-run census in this audit and **no cancellation authorization**.

## Receiver and receipt safety
Reviewed `src/evidence-receiver/{oidc,receiver}.mjs` and corrected PR60 source-binding contract: signed OIDC checks, attempt/job/check-run coupling, distinct REST PR head and merge source, externally pinned package/tree and nonce/JTI storage are required. `verifySourceBinding` is only graph evidence, not workload authentication. Receiver signs `STORED_PENDING_INDEPENDENT_REVIEW` and `receiverDeployment=UNQUALIFIED`; no independent reviewer, protected key custody, real OIDC token or verified confidential transport is configured. Receipt cannot open G0/G1 or production. Presence of all six raw private bundle members remains unverified operationally.

## Gate decision
- **P1 BLOCKED:** exact-head PostgreSQL CI fails all four matrix cells, eight confirmed Q01 phase-2 expectation discrepancies; fix must preserve fail-closed invariants.
- **P1 BLOCKED:** real confidential delivery, reviewer independence/key custody, exact private artifact run/attempt identity and complete evidence retention not proven.
- **P1 BLOCKED:** physical G1 remains CLOSED; no native/ADMINIT acceptance.
- **P2 PASS:** four hosted receiver contract jobs with 410 PASS/2 explicit SKIP and no inspected visible key/JWT/SID leaks.
- **P2 BLOCKED:** no receiver artifacts; Q01 ZIP privacy/SHA256 not independently inspected this turn.
- **P2:** historical cancellation candidates require fresh status/job/artifact and executed revision checks before separate approval.

**G0 confidential operational NO-GO · G1 CLOSED · Q01 OPEN · Production NO-GO**.
