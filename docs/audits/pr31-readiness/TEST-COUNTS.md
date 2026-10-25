# Exact PR31 hosted log counts

Source: downloaded completed job logs via gh api jobs/{id}/logs; exact branch and head only. Repeated workflows/runs are listed separately and must not be added as unique test coverage. Snapshot may include pending aggregate jobs. PR-triggered logs check out refs/pull/31/merge; checkoutEvidence in JSON retains actual merge SHA, so branch/head metadata is not represented as direct commit checkout. Counts are reported per summary block, not inferred from green conclusion.

| Run | Workflow / job | State | Actual summary blocks | Raw log |
|---|---|---|---|---|
| 40183990825 | Book Ingestion Native PDF / native-pdf | completed/success | Node 90 tests / 90 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784727.log |
| 40183990746 | Validate Math Universe / test | completed/success | Node 4 tests / 4 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140785219.log |
| 40183990756 | Experimental Proof Kernel / Proof kernel Node 24 | completed/success | Node 27 tests / 27 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784468.log |
| 40183990756 | Experimental Proof Kernel / Proof kernel Node 22 | completed/success | Node 27 tests / 27 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784470.log |
| 40183990772 | .github/workflows/windows-deployment.yml / Windows contracts / powershell | completed/success | Node 13 tests / 13 pass / 0 fail / 0 skip; Pester 51 pass / 0 fail / 0 skip / 0 pending | outputs/pr31-ci/job-logs/121140784603.log |
| 40183990772 | .github/workflows/windows-deployment.yml / Windows contracts / pwsh | completed/success | Node 13 tests / 13 pass / 0 fail / 0 skip; Pester 51 pass / 0 fail / 0 skip / 0 pending | outputs/pr31-ci/job-logs/121140784770.log |
| 40183990697 | QA SQLite Q01 Diagnostic / Q01 synthetic diagnostic (not acceptance) (22) | completed/success | Node 4 tests / 4 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784877.log |
| 40183990697 | QA SQLite Q01 Diagnostic / Q01 synthetic diagnostic (not acceptance) (24) | completed/success | Node 4 tests / 4 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784952.log |
| 40183990711 | PostgreSQL Integration / Full suite Node 22 / PostgreSQL 18 | completed/success | Node 649 tests / 649 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784319.log |
| 40183990711 | PostgreSQL Integration / Full suite Node 24 / PostgreSQL 16 | completed/success | Node 649 tests / 649 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784473.log |
| 40183990711 | PostgreSQL Integration / Full suite Node 24 / PostgreSQL 18 | completed/success | Node 649 tests / 649 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784500.log |
| 40183990711 | PostgreSQL Integration / Full suite Node 22 / PostgreSQL 16 | completed/success | Node 649 tests / 649 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784519.log |
| 40183990711 | PostgreSQL Integration / Full CI coverage | queued/ | NOT_RUN_PENDING |  |
| 40183990683 | .github/workflows/q01-windows-containment-preparation.yml / Native-free contracts / powershell / Node 22 | completed/success | Node 3 tests / 3 pass / 0 fail / 0 skip; Fake kernel 7 cases / 0 fail / 0 skip / zero native calls | outputs/pr31-ci/job-logs/121140784324.log |
| 40183990683 | .github/workflows/q01-windows-containment-preparation.yml / Native-free contracts / pwsh / Node 24 | completed/success | Node 3 tests / 3 pass / 0 fail / 0 skip; Fake kernel 7 cases / 0 fail / 0 skip / zero native calls | outputs/pr31-ci/job-logs/121140784496.log |
| 40183990683 | .github/workflows/q01-windows-containment-preparation.yml / Native-free contracts / powershell / Node 24 | completed/success | Node 3 tests / 3 pass / 0 fail / 0 skip; Fake kernel 7 cases / 0 fail / 0 skip / zero native calls | outputs/pr31-ci/job-logs/121140784505.log |
| 40183990683 | .github/workflows/q01-windows-containment-preparation.yml / Native-free contracts / pwsh / Node 22 | completed/success | Node 3 tests / 3 pass / 0 fail / 0 skip; Fake kernel 7 cases / 0 fail / 0 skip / zero native calls | outputs/pr31-ci/job-logs/121140784510.log |
| 40183990683 | .github/workflows/q01-windows-containment-preparation.yml / Require all native-free preparation contracts | queued/ | NOT_RUN_PENDING |  |
| 40183990749 | Q01 Detached Journal Regression / detached-journal (windows-latest, 22) | completed/success | Node 11 tests / 11 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784580.log |
| 40183990749 | Q01 Detached Journal Regression / detached-journal (windows-latest, 24) | completed/success | Node 11 tests / 11 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784750.log |
| 40183990749 | Q01 Detached Journal Regression / detached-journal (ubuntu-latest, 24) | completed/success | Node 11 tests / 11 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784794.log |
| 40183990749 | Q01 Detached Journal Regression / detached-journal (ubuntu-latest, 22) | completed/success | Node 11 tests / 11 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784849.log |
| 40183990654 | Browser E2E / chromium | completed/success | Playwright 14 passed (skip count not emitted in matched line) | outputs/pr31-ci/job-logs/121140784215.log |
| 40183990699 | AI Orchestrator Policy (offline) / offline-policy (24) | completed/success | Node 81 tests / 81 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784406.log |
| 40183990699 | AI Orchestrator Policy (offline) / offline-policy (22) | completed/success | Node 81 tests / 81 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784651.log |
| 40183964430 | AI Orchestrator Policy (offline) / offline-policy (24) | completed/success | Node 81 tests / 81 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706592.log |
| 40183964430 | AI Orchestrator Policy (offline) / offline-policy (22) | completed/success | Node 81 tests / 81 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706792.log |
| 40183990649 | Q01 Queue Reliability / Q01 Windows laboratory guard contracts | completed/success | Pester 8 pass / 0 fail / 0 skip / 0 pending | outputs/pr31-ci/job-logs/121140784331.log |
| 40183990649 | Q01 Queue Reliability / Q01 fault / ubuntu-latest / Node 22 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784443.log |
| 40183990649 | Q01 Queue Reliability / Q01 fault / ubuntu-latest / Node 24 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784494.log |
| 40183990649 | Q01 Queue Reliability / Q01 stress / ubuntu-latest / Node 22 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784525.log |
| 40183990649 | Q01 Queue Reliability / Q01 quick / ubuntu-latest / Node 22 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784536.log |
| 40183990649 | Q01 Queue Reliability / Q01 quick / ubuntu-latest / Node 24 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784552.log |
| 40183990649 | Q01 Queue Reliability / Q01 fault / windows-latest / Node 24 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784563.log |
| 40183990649 | Q01 Queue Reliability / Q01 quick / windows-latest / Node 24 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784588.log |
| 40183990649 | Q01 Queue Reliability / Q01 stress / windows-latest / Node 24 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784594.log |
| 40183990649 | Q01 Queue Reliability / Q01 quick / windows-latest / Node 22 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784615.log |
| 40183990649 | Q01 Queue Reliability / Q01 stress / windows-latest / Node 22 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784625.log |
| 40183990649 | Q01 Queue Reliability / Q01 stress / ubuntu-latest / Node 24 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784643.log |
| 40183990649 | Q01 Queue Reliability / Q01 fault / windows-latest / Node 22 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140784648.log |
| 40183990649 | Q01 Queue Reliability / Q01 complete execution coverage | queued/ | NOT_RUN_PENDING |  |
| 40183964442 | .github/workflows/windows-deployment.yml / Windows contracts / pwsh | completed/success | Node 13 tests / 13 pass / 0 fail / 0 skip; Pester 51 pass / 0 fail / 0 skip / 0 pending | outputs/pr31-ci/job-logs/121140706570.log |
| 40183964442 | .github/workflows/windows-deployment.yml / Windows contracts / powershell | completed/success | Node 13 tests / 13 pass / 0 fail / 0 skip; Pester 51 pass / 0 fail / 0 skip / 0 pending | outputs/pr31-ci/job-logs/121140706685.log |
| 40183964407 | PostgreSQL Integration / Full suite Node 22 / PostgreSQL 18 | completed/success | Node 649 tests / 649 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706500.log |
| 40183964407 | PostgreSQL Integration / Full suite Node 24 / PostgreSQL 18 | completed/success | Node 649 tests / 649 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706632.log |
| 40183964407 | PostgreSQL Integration / Full suite Node 22 / PostgreSQL 16 | completed/success | Node 649 tests / 649 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706645.log |
| 40183964407 | PostgreSQL Integration / Full suite Node 24 / PostgreSQL 16 | completed/success | Node 649 tests / 649 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706686.log |
| 40183964407 | PostgreSQL Integration / Full CI coverage | queued/ | NOT_RUN_PENDING |  |
| 40183964363 | Book Ingestion Native PDF / native-pdf | completed/success | Node 90 tests / 90 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706408.log |
| 40183964438 | Q01 Queue Reliability / Q01 stress / windows-latest / Node 22 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706731.log |
| 40183964438 | Q01 Queue Reliability / Q01 Windows laboratory guard contracts | completed/success | Pester 8 pass / 0 fail / 0 skip / 0 pending | outputs/pr31-ci/job-logs/121140706734.log |
| 40183964438 | Q01 Queue Reliability / Q01 quick / windows-latest / Node 24 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706745.log |
| 40183964438 | Q01 Queue Reliability / Q01 quick / ubuntu-latest / Node 22 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706778.log |
| 40183964438 | Q01 Queue Reliability / Q01 fault / windows-latest / Node 22 | in_progress/ | NOT_RUN_PENDING |  |
| 40183964438 | Q01 Queue Reliability / Q01 quick / ubuntu-latest / Node 24 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706787.log |
| 40183964438 | Q01 Queue Reliability / Q01 stress / windows-latest / Node 24 | in_progress/ | NOT_RUN_PENDING |  |
| 40183964438 | Q01 Queue Reliability / Q01 stress / ubuntu-latest / Node 22 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706808.log |
| 40183964438 | Q01 Queue Reliability / Q01 stress / ubuntu-latest / Node 24 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706812.log |
| 40183964438 | Q01 Queue Reliability / Q01 fault / ubuntu-latest / Node 22 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706819.log |
| 40183964438 | Q01 Queue Reliability / Q01 quick / windows-latest / Node 22 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706820.log |
| 40183964438 | Q01 Queue Reliability / Q01 fault / windows-latest / Node 24 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706836.log |
| 40183964438 | Q01 Queue Reliability / Q01 fault / ubuntu-latest / Node 24 | completed/success | Node 15 tests / 15 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706851.log |
| 40183964400 | Validate Math Universe / test | completed/success | Node 4 tests / 4 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706455.log |
| 40183964374 | Browser E2E / chromium | completed/success | Playwright 14 passed (skip count not emitted in matched line) | outputs/pr31-ci/job-logs/121140706479.log |
| 40183964372 | Experimental Proof Kernel / Proof kernel Node 24 | completed/success | Node 27 tests / 27 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706432.log |
| 40183964372 | Experimental Proof Kernel / Proof kernel Node 22 | completed/success | Node 27 tests / 27 pass / 0 fail / 0 skip | outputs/pr31-ci/job-logs/121140706555.log |
| 40183964395 | .github/workflows/q01-windows-containment-preparation.yml / Native-free contracts / powershell / Node 24 | completed/success | Node 3 tests / 3 pass / 0 fail / 0 skip; Fake kernel 7 cases / 0 fail / 0 skip / zero native calls | outputs/pr31-ci/job-logs/121140706544.log |
| 40183964395 | .github/workflows/q01-windows-containment-preparation.yml / Native-free contracts / pwsh / Node 22 | completed/success | Node 3 tests / 3 pass / 0 fail / 0 skip; Fake kernel 7 cases / 0 fail / 0 skip / zero native calls | outputs/pr31-ci/job-logs/121140706612.log |
| 40183964395 | .github/workflows/q01-windows-containment-preparation.yml / Native-free contracts / powershell / Node 22 | completed/success | Node 3 tests / 3 pass / 0 fail / 0 skip; Fake kernel 7 cases / 0 fail / 0 skip / zero native calls | outputs/pr31-ci/job-logs/121140706637.log |
| 40183964395 | .github/workflows/q01-windows-containment-preparation.yml / Native-free contracts / pwsh / Node 24 | completed/success | Node 3 tests / 3 pass / 0 fail / 0 skip; Fake kernel 7 cases / 0 fail / 0 skip / zero native calls | outputs/pr31-ci/job-logs/121140706670.log |
| 40183964395 | .github/workflows/q01-windows-containment-preparation.yml / Require all native-free preparation contracts | completed/success | No matched test-count summary | outputs/pr31-ci/job-logs/121141351832.log |

Skipped test identities, raw summary lines and Q01 case JSON are retained in test-counts.json evidence[]. Null means not emitted/extracted; it is not zero. No native or physical containment claim follows from hosted mock compatibility. Q01 OPEN / production NO-GO.