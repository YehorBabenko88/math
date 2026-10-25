# PR56 private receiver follow-up acceptance

Base PR56 HEAD `920fd4977192bdd29606cb58d193fc7998a1c862`, tree `03f9666ee4a77ad15dc3eb5dee355a175f3a9f3d`. New branch `feat/pr56-confidential-evidence-receiver`. Implementation commit `305b0f4f5128fa78522cf9ec518f9e5322755b01`, tree `e93045dcf6fbc814be13875bdf08a00a23d13138`; final delivery adds report/hash/byte-clarification documents only. Final HEAD/tree are supplied externally by GitHub commit metadata/PR and delivery response; a file cannot contain its own Git commit hash.

Read [independent PR56 checkpoint](https://github.com/YehorBabenko88/math/pull/56#issuecomment-6399631048): exact HEAD/tree source review, digest-only acceptance blocker, compiled package review still required, no independent reproduction of contributor tests. No prior green/pending result is promoted to native acceptance.

## Implemented

- Local sealed-courier receiver LIBRARY, no listener or auto-start: external RSA3072/4096 recipient key, separate Ed25519 receipt key, AES256-GCM, RSA-OAEP-SHA256. Synthetic ephemeral keys in RAM only. No secrets/raw evidence committed, uploaded or printed by the receiver. No real keys provisioned or system settings changed.
- GitHub RS256 verification with fixed issuer/JWKS HTTPS, bounded strict JSON/duplicate-key rejection, exact policy/repository/owner/workflow/source/subject/event claims and nonce audience. Signed check_run_id is matched to independent job API, attempt-specific complete job inventory and run/source commit API. No invented signed job_id claim. Direct and PR-merge source relationships are explicit; PR parent/base/head mismatch denied.
- Local SQLite receiver journal outside Git trees, unknown schema/version refused, BEGIN IMMEDIATE, atomic nonce/token/JTI consumption with encrypted original evidence and independently observed encrypted API/JWKS capture. Competing connections, rollback, restart, clock rollback and duplicate JTI tests. This is not the Book/Q01 queue and never touches PostgreSQL.
- Actual ZIP bytes and SHA256, exact seven-file protocol inventory, central/local headers, CRC, offsets, modes, bounds and package/source/native schema validation. STORE-only protocol; unsupported compression/features rejected. No extraction or execution. Independently supplied expected package pins are mandatory; producer self-hashes alone are insufficient.
- Signed public projection is only STORED_PENDING_INDEPENDENT_REVIEW and receiverDeployment=UNQUALIFIED. It keeps Q01 OPEN, PhysicalG1 BLOCKED, production NO_GO and Book gate CLOSED. Different keys alone do not establish operator independence.
- Separate source-fragment/fake-kernel bootstrap120s and actual PowerShell150s timeout-branch models. Owner-watchdog/PowerShell cleanup, hosted-only fixture and Execute guard source remain unchanged. Real native timing/drain qualification remains BLOCKED.

[Protocol and missing trust prerequisites](LOCAL_RECEIVER_PROTOCOL.md) describe the exact API/bundle and local deployment boundary. There is deliberately no secret loader, accepted real receiver endpoint, GitHub id-token permission or activated transport. Operational confidential acceptance is NOT complete.

## Obsolete queued inventory / cancellation proposal

[Exact inventory](obsolete-queued-inventory.json): 1878 queued runs enumerated over18 workflows; all queries below1000 cap, 1033 unique HEAD/path sources retrieved with no source/API errors. Non-atomic snapshot interval is recorded. There are370 source-HEAD raw-publication candidates:335 Q01 reliability +35 ADMINIT;10 fixed digest/metadata variants.175 candidates are PR events whose actual merge workflow revision remains unresolved. HEAD source establishes risk, not proof of executed configuration or actual disclosure. Other workflows are checked against stated direct signatures only, not certified privacy-safe.

[Proposal](proposal.md) provides exact run IDs/attempts/source evidence and byte hashes. NO run was cancelled, rerun or dispatched. Revalidate individual status, attempt and executed revision before separately approved targeted cancellation; no mass action is authorized here. Historical Git/artifact contents are not erased.

Inventory original worktree bytes SHA256 `3f9fdbabfb1b86c913e17a4a7320b0ecd85a7d44a38c087de6f40a10d34964d2`; committed LF bytes SHA256 `c3506dc04242b14f8316bb1494c61c8609c1975fe44be56f2ff81ba4fc255b52`. Both are explicitly scoped; no historical SQL/ledger normalization.

## RED/GREEN and review

Preserved RED before implementation for OIDC verification, sealed vault/journal, bundle, receiver flow and actual ZIP parser. Additional RED/GREEN covers provider URL/query/error redaction, token lifetime versus nonce expiry, unrelated PR parents/API base, invalid UTF8/JSON bounds, missing retained attempt inventory. Tampered ciphertext/digests/claims/source/workflow/run/attempt/job, replay/expiry, damaged/incomplete ZIP/bundles, malformed package and forged/wrong-key receipts are rejected. Bundle semantic mutations recompute manifest hashes to avoid merely testing checksum mismatch.

Independent read-only code review found no concrete P1/P2 bypass within the inspected library scope. It identified missing retained attempt evidence and test-quality gaps; the attempt response is now stored encrypted, concurrent journal/JTI/parser/forged-receipt tests added. The review ran79 receiver tests, not real-platform/native qualification. SHA256 [manifest](local-evidence-sha256.json) distinguishes expected RED, intermediate failures and final approved checks; raw logs remain private.

## Approved verification matrix

| Scope | Result |
|---|---|
|Windows Node22.23.3,59 approved pure/static/model files|477 PASS /0 FAIL /5 explicit SKIP,482 tests|
|Windows Node24.20.0, same selection|477 PASS /0 FAIL /5 explicit SKIP,482 tests|
|Receiver-focused seven modules/tests|79 PASS, synthetic crypto and isolated receiver storage only|
|Bootstrap model + static guards|2 PASS;9 fake-kernel cases, zero native calls|
|PowerShell150s timeout branch|4 fake-owner cases PASS, never actual process lifecycle proof|
|PowerShell5.1 fixture compile/model, Execute guards/parser|PASS; Main not invoked|
|Mandatory CI contract / SQL bytes / dependency policy / diff check|PASS; historical11 SQL files unchanged|
|New hosted CI / real GitHub OIDC token / confidential delivery|QUEUED or NOT_RUN/BLOCKED; inspect exact final SHA runs separately|
|Real bootstrap120s and PowerShell150s expiry/native descendant drain|BLOCKED|
|Local receiver keys/ACL/custody/operator independence|NOT_CONFIGURED / UNQUALIFIED|
|ADMINIT Execute / PhysicalG1 / Production / Book gate|CLOSED / BLOCKED / NO_GO / CLOSED|

Five approved-selection skips are existing symlink/POSIX fixture capability limits, not PASS. The59-file selection is NOT a full unfiltered PG/PDF/Browser run. New workflow runs Node22/24 x Linux/Windows contracts with contents:read only, pinned Actions, no id-token, endpoint, credentials or raw uploads. Windows-only PowerShell model is explicitly skipped off Windows; static checks still run.

## Process deviation — do not treat as acceptance

A ZIP subagent mistakenly executed `npm test` beyond its authorized focused scope during concurrent dirty-tree development. It completed910 tests:794 PASS,9 FAIL,107 SKIP. It included the Q01 concurrent-first-open diagnostic (default20 pairs; QA_Q01_ROUNDS absent), using temporary synthetic SQLite directories. This was NOT authorized physical/Q01 admission. It must not be described as a successful full suite or ignored. Root stopped further broad execution; no full rerun was made.

Eight failures concerned existing detached-journal rejection message expectations (`Invalid queue directory` versus `Invalid queue state`) and one the then-incomplete bootstrap model. Relevant Book queue/test source is unchanged by this branch; exact-base reproduction was NOT performed because additional Q01 execution is prohibited. Final approved bootstrap models pass. This does not resolve the eight queue failures or Q01. The run's dirty concurrent source state is not an exact-HEAD qualification.

Initial model invocation also used a process-level ExecutionPolicy Bypass flag; it has been removed. No persistent Set-ExecutionPolicy command was issued. All final model invocations use NoProfile/NonInteractive without bypass. No native fixture EXE, production migration, service operation, cancellation or deployment was authorized or performed by the receiver work. Historical laboratory and existing PostgreSQL were not modified by these changes. Preserve and independently audit this deviation; it is a P1 process/control finding.

Accidental full-run log SHA256 `ab980bd995b0ecbf4829904452e3985f616242eb0356b6c909fa0cec1828c6ec`; raw log contains local diagnostic paths and remains PRIVATE. Its failures/skips are recorded separately from approved results.

## Decision

GO for independent code review only. NO-GO for operational confidential acceptance or physical tests. Required next decisions: accept receiver/collector implementation and trust policy independently, identify key custodians and protected local vault, qualify real OIDC/check-run/source relation and confidential transfer, then obtain fresh independently captured hosted native evidence. Separate operator decision is required for proposed cancellation candidates; none is executed here.

All original PRs/main, historical laboratory, PostgreSQL, owner/PowerShell/Execute guards, scientific verification gates and Book production gate remain unchanged. No result automatically becomes VERIFIED. Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book gate CLOSED.
