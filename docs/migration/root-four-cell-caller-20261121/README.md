# Six Math plus four Root unit cells

Root matrix caller and artifact-custody source are pinned to published 802e78640adc0af6f1c5e04b37fa0f41b70b6a45. The collector remains the separate one-job caller from thin candidate 556d25728c09db954563581a75cad2325826bf7f, pinned to RBravo 4ba390b8e12070499d54b12e5609c683c00607ee.

The full coverage job waits for six Math cells and four Root cells in its own workflow run. Six Math receipts still bind the actual tested commit and tree. For pull requests that commit must have ordered parents [event base SHA, event head SHA]; Root receipts bind run.head_sha and the actual PR head, not the synthetic tested merge. Root-owned custody reads current REST metadata before and after downloading all four official artifacts, verifies archive digests and the exact original 34 roles per cell.

A fresh private pinned Root checkout is checked by detached HEAD, no-follow single-link bounded file reads and ten fixed raw SHA256 entries. Verified bytes are copied into a fresh private directory before importing the Root-owned collector. API credentials are supplied only to that collector, with no injected fetcher. No OIDC is requested by this workflow.

Missing or failed Root cells, stale metadata, failed downloads or inconsistent identities leave the gate HELD. Complete ten-cell unit coverage is VERIFIED_TEN_UNIT_CELLS only: source authentication NOT_EVALUATED, native acceptance NOT_QUALIFIED, release NO_GO. Historical 188-file, 1234-case and 34-transfer ledgers are unchanged.

Local validation is source/pure/inert only; no local network, PostgreSQL, native process, PowerShell/CMD, SourceFence or compiler execution. The new .unit.mjs is explicitly invoked in CI; it does not silently alter the frozen original case roster. Actual hosted ten-cell proof remains required on the published candidate SHA.

The current Root observer adds descriptor-only closed binding-state diagnostics; node:util is a builtin and adds no repository-code dependency. Both contract and workflow hashes in the ten-file source closure are bound to802e786. These diagnostics are not receipts and do not establish the live E_BIND cause.

Root802 adds the producer-only queued aggregate run compatibility while retaining exact active job and identity guards. Completed consumers still require run in_progress and completed successful jobs. Existing Root878/03 partial hosted failures remain historical evidence; only the new candidate can establish four-cell results. The application SDK cohort stays at Math e99 because these CI-only changes do not alter SDK bytes.
