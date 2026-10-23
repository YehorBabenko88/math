# PR12 integrity remediation contracts

Scope: F01–F05 from `F03_R06_FINAL_INDEPENDENT_AUDIT.md`, base `2ecbfd9fb050d5e863122f2a47817ab1ac69e1f4`. Production NO-GO; Book gate CLOSED.

## Pester

Installation refuses an existing destination, even if empty. The approved ZIP digest remains mandatory. Extract into a new directory and verify all materialized files, file hashes and directories against the ZIP; reject reparse ancestors/entries. `-VerifyOnly` must succeed immediately before importing the framework. Windows CI prepares it before candidate JavaScript, runs standalone integrity regressions in both shell profiles and rechecks composition before import.

This is point-in-time filesystem evidence. Candidate-controlled scripts and other processes running as the same OS user can modify files or the verifier, including between check and import. Hashes and ordering do not replace separate process/account isolation. No independent or tamper-proof attestation is claimed.

## SQL reference and staged index

The SQL verifier reads raw Git objects with `--no-replace-objects`. It requires the exact six generic SQL001–006 and five Book SQL001–005 paths, each a regular mode-100644 blob, with the same complete index set and object IDs. Staged SQL drift is rejected even when disk bytes were restored to HEAD. Parent and leaf symlinks/junctions are rejected. Disk bytes must equal the raw reference blobs without normalization.

The verifier never repairs checkout bytes or ledgers. Historical LF/CRLF incompatibility must stop migration. Establish historical execution evidence and an explicit operator-reviewed compatibility plan; never adopt current bytes as historical proof. Adding a future migration requires updating the expected inventory in a separately reviewed change.

## npm and Python inputs

The manifest validator permits only the reviewed manifest keys and scripts. Unknown keys, overrides, workspaces, lifecycle scripts and other unreviewed installation directives are denied. The existing exact versions, package-lock graph and Python hashes remain unchanged. CI uses `npm ci --ignore-scripts --no-audit --no-fund` and pip hash-required wheel-only installation.

This validates committed inputs, not every user/global `.npmrc`, environment override, npm binary, installed `node_modules`, browser executable, Python interpreter or runner image. Offline npm dry-run regression proves planning acceptance/rejection only, not a new fetched-artifact or installed-filesystem attestation. Unsupported Python platforms remain fail closed.

## Source and provenance

Every provenance-producing CI job captures tracked source/index identity before tests, to an exclusively created receipt outside checkout, and revalidates it after tests before generating qualified evidence. It reads raw non-replaceable Git trees, rejects unsupported modes/reparse paths and checks every tracked file directly, bypassing assume-unchanged/skip-worktree trust. Only Git-policy-permitted CRLF text checkout conversion is accounted for; raw lock/SQL contracts remain stricter. Generated untracked `node_modules`, test results, bytecode and provenance output are outside the **tracked** identity claim; they cannot exempt a tracked file from validation.

The manifest distinguishes `sourceSha` (committed source), `committedTreeSha`, `trackedSourceSha256`, `testedWorktreeVerified` and `sourceEvidence=self-reported-pre-post-tracked-tree/v1`. The release consumer requires this evidence and compares the committed tree with the trusted repository's tree. This is a candidate-produced manifest bound by GitHub archive metadata, not independent attestation. Pre/post checks do not prove absence of temporary modifications restored between checks; same-user malicious execution requires isolation.

Repository, known workflow path, positive bounded run ID/attempt and the workflow's exact required context must validate before qualification. Missing fields, controls, unknown workflows and cross-workflow contexts fail closed. Receipts bind these fields; another run/attempt cannot reuse one.

## Workflow selection and artifact HTTP access

The gate deliberately considers latest activity before checking that the selected event is a trusted push. A newer PR/dispatch, failed rerun or pending run can therefore block an older successful push. There is no fallback to stale success. PR merge-ref manifests are not substitutes for source-HEAD push evidence, even when their tree equals the head tree.

The existing updater's unauthenticated GitHub artifact ZIP endpoint returns HTTP 401 in the observed environment; authenticated read-only gh downloads work. No production credentials or token discovery were added. Operators need a separately reviewed authorized transport design before real deployment. Do not embed tokens, forward authorization to arbitrary redirect hosts or weaken digest/source/run/attempt checks to work around the failure. This operational blocker remains explicit, and no deployment is authorized by this work.
