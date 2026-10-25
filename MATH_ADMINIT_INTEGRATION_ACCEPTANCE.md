# Math Universe integration and ADMINIT readiness acceptance report

2026-10-25. **Q01 OPEN. PhysicalG1 BLOCKED. Production NO-GO. Book production gate CLOSED.** This report applies to the integration branch commit containing it; exact published HEAD/tree and fresh CI IDs are recorded in its Draft PR. It does not certify physical execution.

## Scope and exact source selection

Base PR31 `cb168925b5aeec0c957137dd94ab72c64f0bd333`, tree `10cfd29f5d2c75e841d88dd70bef8773dada8287`. New branch `integration/math-adminit-readiness`. Ordinary no-ff merges preserve source histories; no merge into main or source branches. Merged checkpoint before new isolation/privacy work: `b767e7debf6ef61127e63f7359365606a426ebef`.

Full exact source SHAs/trees and corrections: [source-selection.json](docs/audits/adminit-integration/source-selection.json).

| PR | Integrated selection | Review / disposition |
|---|---|---|
|33|a075beee5802515710d481bec431a57c43afb6eb|Real POSIX symlink journal replacement tests. Later head a91549a adds35 documentation lines only and is not silently substituted.|
|34+41|c8c070249ac3327c5a4dd2fadf17c08f8775433c|Two-parent bridge preserves PR41 280096a and PR34 e64fe5e. Mock conflict resolved with full ordered traces, production helper unchanged after PR41.|
|35|4cc48933c502c29e135990028008f7aae5644407|Independent property/negative tests and Proxy guard. Earlier731701b/5e332b3 moving heads not treated as this snapshot.|
|36|42b930c + correction f8b4f2646144b354619a0324e9ba5858ed2e8232|Source/attempt diagnostics fixed after schema validation and before unchanged full bindings.|
|38|530fd47 + correction4418bf542ee3853db013749aecfa2d4ba2dcec87|Retain hostile-input tests; restore safe omitted/undefined auto-ID duplicate behavior. No confirmed baseline active-input exploit.|
|39|8cdf0aa89c18a1ef23c9653528db8fa1506b3418|Historical correction only. Withdrawn P1 not reintroduced, historical PASS not current qualification.|
|40|8ec4d1e2fe14ba917c715bf6e44465ea31dd50e7|Read-only preflight tracked-source binding. No physical execution enabled.|
|41|280096ab24ce4f32cdaf17bd4a928f66f4f2dbda|Bounded drain and hosted harness preparation via bridge above; native acceptance remains missing.|
|42|ab8b8099189e599ed61c7e7891c66e3585cc0fbd|PENDING validation before consuming result nonce.|
|43|d30eab8eb9b89fe8da018dcd136125714029b072|Only Windows EPERM/EACCES symlink creation checks SKIP; hardlink/alias assertions independent.|
|44|e72d7f1e438d3d8873eacad8fdfc6dd78553d7be, tree724134b6c61b34c54ef72e4119b5966148f48659|Independent source review,27pure tests;5native cases NOT_RUN. Local machine gate remains closed.|
|37|EXCLUDED|Withdrawn P1/sentinel patch is not included; no claim that BOOK_QUEUE_INITIALIZING was swallowed.|

PR45–47 appeared during this work, outside the selected list. Bounded read-only review:45 contains a regex syntax error preventing a test module loading;46 retains/validates blob IDs as additional defensive validation, no demonstrated fsck/source bypass;47 correctly identifies absolute paths/stack traces hidden in base64 evidence. None was merged. Relevant privacy concern addressed directly with a tested forward-only derivative, preserving original history.

## Confirmed findings and RED/GREEN corrections

| Finding | Priority | Evidence and correction |
|---|---|---|
|PR34 mock expectation incompatible with cleanup finally and PR41 drain|P2|Original RED; exact trace must contain kill-process/wait after a kill-job fault. Bridge retains23 exact traces and unconfirmed-drain exception assertion, GREEN. Only mock/docs changed vs41.|
|PR36 four error-precedence/API tests fail|P2|RED5PASS/4FAIL; schema validation precedes specific SOURCE_* diagnostics, then all receipt/budget/toolchain bindings remain. Full AI GREEN110/110 each22/24. Assertions unchanged plus3schema regressions.|
|PR38 no-ID repeated candidate rejects|P1 compatibility regression in proposed change|Base succeeds, PR38 throws revision entity conflict due fresh UUID. Missing/undefined regressions RED; corrected32/32 each22/24. Effective production difference vs base is explanatory comments, not an unproved snapshot exploit fix.|
|New collector Git command violates read-only confinement|P2, fixed before publication|Independent181-byte trace write reproduced only in authorized scratch output via inherited GIT_TRACE; Git metadata/env can also redirect. Removed every Git/subprocess invocation, source nowUNKNOWN. RED7PASS/1FAIL then8PASS. Collector never run on ADMINIT.|
|Encoded local evidence contains paths/stack traces|P2 privacy/publication concern|Bounded independent decode found6of13 records with paths/traces; no credential leak established. Current two evidence documents now SHA/byte-count only. All20 original payload hashes verified before preserving originals locally/history; RED2FAIL thenGREEN2PASS. Forward redaction cannot erase prior public history.|

No new demonstrated P0 runtime exploit or formal-proof promotion found. These are scoped findings, not proof that all code is defect-free. Independent native qualification and effective isolation remain acceptance blockers.

## Compatibility and boundaries

- Candidate duplicate IDs, explicit collisions, inert records, signed result bindings and nonce behavior retested together. OCR/LLM/book output is extraction/review-required data, not VERIFIED.
- Experimental proof checker remains CHECKED_IN_EXPERIMENTAL_KERNEL within supported implication calculus. Signed protocol assessment is AUTHENTICATED_RESULT_ONLY, not theorem validity or scientific review. AI result/source APIs return NOT_VERIFIED / DENIED / UNRESOLVED_OBJECT_IDS.
- PR35 imports node:util and is Node-only. Current browser modules do not import it; no current browser regression found. This is not a browser-compatible proof API claim.
- Book queue, PostgreSQL migrations/transfer/production blockers and backend routing unchanged from PR31. SQL001–006 and Book001–005 unchanged. No startup migration, production cutover or new automatic backend routing.
- Text conflict occurred only between original PR34/41 mock changes, resolved in the bridge. Root merges were clean. API-specific regressions above were reproduced instead of hidden by retries/filtering.

## Test matrix and evidence

| Lane | PASS | FAIL | SKIP / state |
|---|---:|---:|---|
|Integrated local selected40pure/model/static files, Node22.23.3|298|0|5of303|
|Same Node24.20.0|298|0|5of303|
|Privacy publication regressions (included above)|2|0|0|
|Windows mocked safety guards, Pester|12|0|0|
|Contained-job injected kernel|23 ordered traces +drain exception assertion|0|zero native calls|
|SQL checkout verifier|11files|0|historical bytes preserved|
|Dependency-lock verifier|PASS|0|no dependency changes|
|PR44 independent pure review|27|0|0; exact PR44, not new-candidate CI|
|New integrated full unfiltered Node22/24 ×PG16/18|NOT_RUN locally|NOT_RUN|fresh CI required; existing protected PG18 not used|
|PDF / Browser / Windows hosted qualification|NOT_RUN locally|NOT_RUN|fresh exact-head CI required|
|Native normal/timeout/crash/assignment/cleanup|0executed|0observed|5NOT_RUN/BLOCKED|
|ADMINIT snapshot / native / Q01 next stage|NOT_RUN|NOT_RUN|BLOCKED / next stage DISABLED|

Five local skips are explicit: unavailable ledger directory symlink; POSIX directory mode semantics; unavailable symlinked ancestor; denied file symlink fixture; denied directory symlink fixture. Hardlink and alias negatives execute. Partial local inventory does not replace unfiltered mandatory CI; overlapping suites are not added as unique coverage.

Hash-only evidence inventory: [evidence-sha256.json](docs/audits/adminit-integration/evidence-sha256.json). Raw local evidence is retained outside publication; no base64/absolute local paths exported by the new report. Historical records remain bound to their original commits/runs.

Exact PR44 push40195832471 / PR40195836730: independently checked head e72d7f1,5queued jobs each, steps=[],0artifacts at review. Native PID/handle evidence and package ZIP/manifest SHA256 are unavailable, not assumed. PR event GITHUB_SHA can be synthetic merge commit; API head_sha alone is not artifact source identity. New-candidate CI must be checked independently on its final SHA; no fallback to older successful run, source head or tree.

## Containment result

IMPLEMENTED / NOT_INDEPENDENTLY_QUALIFIED. Old hosted-only guard unchanged. Framework harness compiles without SDK, but compile/model PASS cannot establish native containment. Job assignment before Resume, kill-on-close, process handle identities and bounded drain are implemented; forced expiry of the independent external watchdog is still an acceptance gap. An absent/cancelled/queued job is not PASS. A Job Object is not filesystem/network/database isolation.

## Isolation and ADMINIT facts

Whole local PC is a test environment per user scope. Preserve historical MathUniverseLab, existing source trees and PostgreSQL18 nevertheless. No local connection, service query/action, ACL/policy/firewall/UAC change, native fixture or physical G1 occurred.

User reports Windows PowerShell5.1 build26100.9711, Node24.20.0, Git2.55.0.windows.5, MediumRID8192, Administrators deny-only, CurrentUser RemoteSigned and Add-Type. Previously Restricted; cause/actor/time UNKNOWN. No attribution or attempt to change it.

New collector/evaluator: [criteria](docs/audits/adminit-readonly-isolation-criteria.md). Collector emits only stdout observations from local OS APIs; no subprocess or explicit write, service/endpoint query. OS/runtime caching/auditing not assessed. Source deliberatelyUNKNOWN pending qualified delivery. Evaluator rejects authority extras, binds freshness/source expectations and **always returns isolationConfirmed:false/admission:BLOCKED/localExecute:false**. No text, environment, caller boolean or unqualified signature can open it. Offline NIC snapshot cannot prove loopback/protected PG denial or continuous protection. Deny-only attributes, other resource rights and measurement provenance remain unqualified.

Active new root is `%LOCALAPPDATA%\MathUniverseAdminitAcceptance`, outside historical MathUniverseLab. Current ADMINIT package verifier targets it; old PR44 document path is historical, not current instructions. No new root/checkout was created on ADMINIT. [Future standalone checkout plan](docs/audits/adminit-future-checkout-plan.json) never overwrites old trees, uses no linked worktree/alternates and is NOT_EXECUTED. [Next Q01 stage](docs/audits/adminit-next-q01-stage-design.md) is DESIGN_ONLY with no trigger/command to start it.

## Next concrete safe ADMINIT step

After separate permission for read-only observation, in the existing non-elevated PowerShell session record only:

```powershell
$PSVersionTable.PSVersion
Get-ExecutionPolicy -List
[Environment]::MachineName
[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
```

No new native EXE, collector, checkout/staging, installation or test launch follows automatically. Independently accept exact source delivery and hosted native evidence, define/qualify the existing resource-protection mechanism, then explicitly admit a later synthetic stage. Do not use an environment flag, policy string or test-PC purpose as permission.

**Decision: GO for independent code review only. Q01 OPEN; PhysicalG1 BLOCKED; Production NO-GO; Book gate CLOSED.**
