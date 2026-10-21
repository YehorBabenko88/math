# F03/R06 integration audit

Date: 2026-10-21. Branch: `integration/math-f03-r06`.
Base: `8dd1186f3fc34fa0148eb137cb44fc2416321e7c`.
Audited implementation HEAD: `ff04e77d4d30c094d1de45683d5e9dd63c073914`.
The report commit is the delivery HEAD; its exact SHA and SHA-bound Actions URLs
are supplied in the final handoff (a report cannot embed its own Git object hash).
Production remains NO-GO. No PR is created.

## History and conflicts

All source branch tips matched the requested SHAs before merging. The integration
worktree was clean before each merge, and all merges used `--no-ff` in this order:

| Merge commit | Preserved second parent |
| --- | --- |
| `52efc89cc41da141d7b83864e9724979ce7e7131` | `af9d98921eaaf683cae564eecfab9401fd45436f` SQL |
| `0366302aade09a130a92e7485f60283e06cc6e80` | `3c2dedf5e50cc7bb52e7079d69e65c2647abff4e` dependencies |
| `2c37572477e2178495a39618838f2878465177a6` | `fa70f0384fadd9655e3ef377f0d9a9c1e4b7a5b8` provenance |

No squash, rebase or cherry-pick was used. Source branches were not changed.
SQL merge: no conflicts. Dependency merge: `.gitattributes` and
`postgres-integration.yml` conflicted; resolution retains BOTH raw SQL/lock byte
rules, SQL verifier, dependency validation, npm ci and hash/wheel-only pip flags.
Provenance merge: book-ingestion, browser, ci and postgres-integration workflows
and `windows-deployment.Tests.ps1` conflicted. Resolution retains dependency
checks/install flags, immutable Action refs, source provenance upload steps and
both complete Pester groups. Windows workflow auto-merged but required semantic
review (see I02). All seven shared files named in the task were reviewed.
Verifier ordering was subsequently adjusted to use the explicitly selected Node
runtime, rather than the runner's preinstalled Node.

## Findings (P0–P3)

### I01 — P1, fixed: presence-only provenance qualification

The inherited generator accepted committed `{"lockfileVersion":3}` as
`qualified=true`, with no npm manifest/closure or Python policy validation.
The RED is preserved at `outputs/f03-integration-red.log`; its assertion reports
“Missing expected exception: root-only committed lock must not qualify”.

The generator now validates exact committed package.json, package-lock.json and
Python requirements using the shared dependency validator. Missing/inconsistent
root entries fail; the reviewed canonical npm graph digest rejects added or
modified transitive package metadata even with syntactically valid integrity and
registry fields. The canonical graph is a validation allowlist, not a rewritten
lockfile. Updating it requires explicit policy review. The separate RED for an
unapproved registry package is `f03-integration-graph-red.log`.
Python validation checks exact versions and exact reviewed wheel SHA256 sets,
not merely hash formatting. An all-zero or additional unapproved digest fails.

Qualified manifests carry `dependencyPolicy=math-dependency-contract/v1`, committed
lock SHA256, package manifest SHA256 and Python requirements SHA256. Raw committed
lock bytes must match checkout bytes; package JSON must agree semantically, and
Python text must match committed text allowing only platform EOL differences.
This EOL handling never applies to SQL or persisted migration checksums.

Before accepting release artifacts, the updater calls
`Get-DeploymentDependencyEvidence`, which invokes the trusted local validator
against the candidate's Git blobs, without executing candidate code. It checks
the native process exit immediately. Artifact manifests must match these expected
source digests and policy in addition to all inherited SHA/run/attempt/context
checks. Older manifests without the new policy fields fail closed.

GREEN: focused dependency/provenance tests pass; synthetic Pester verifies valid
committed contracts, an invalid committed lock and mismatched artifact source
evidence. Missing lock remains unqualified; it is never silently adopted.

### I02 — P2, fixed: mutable Action retained by semantic auto-merge

The SQL branch added setup-node to Windows while the provenance branch pinned
other refs. Git auto-merge left that added action at `@v4`. The inherited immutable
Action test failed in the same initial RED log. It now uses the reviewed immutable
setup-node commit, and every external workflow Action reference is a full SHA.

### I03 — P2, fixed/retained: required CI and native exit contracts

Conflict resolution retains npm ci in every mandatory npm installation path and
`pip --require-hashes --only-binary=:all:` in mandatory Python installations.
All producing contexts emit provenance after successful tests. Pester download
is digest checked before extraction. The Windows SQL verifier block preserves
both immediate LASTEXITCODE guards; its regression requires exact exit-7 failure
and proves the second command did not run. No name filters/retries/weakening were
introduced. The complete Node test inventory includes the checkout unit file,
both incompatible-ledger live tests and deterministic interposed-blocker tests.

### I04 — P2/P3 residual boundaries

Historical CRLF or unverified filename-only ledgers remain incompatible and fail
closed. Current source bytes are not historical execution evidence; the source
SQL report contains the operator compatibility plan. No backfill, SQL
normalization or ledger adoption occurred. All eleven historical SQL blobs and
all Book gate/controller source files remain identical to the exact base.

Approved artifact identities do not prove package safety, installed environment
identity, OS isolation or SLSA provenance. Python support is scoped to reviewed
CPython 3.12 Windows amd64/glibc Linux x86_64 wheels. Node/Python patch selectors,
OS/container images, browser downloads and bootstrap catalog inputs remain
operational reproducibility limits. Artifact authentication relies on authorized
GitHub HTTPS/API metadata; missing digest, access, context or evidence fails
closed. No production credentials or new authentication mechanism were added.

No P0 was demonstrated in this bounded integration audit.

## Tests and evidence

The full unfiltered local runner used 84+ merged test files, concurrency 4,
Node22.23.3/24.20.0, and disposable PostgreSQL16.15/18.1. Exact inventory counts
are emitted by the runner; no test selector was passed.

| Local check | Result |
| --- | --- |
| Node22 / PostgreSQL16 | 423 passed; zero fail/cancel/skip/todo |
| Node22 / PostgreSQL18 | 423 passed; zero fail/cancel/skip/todo |
| Node24 / PostgreSQL16 | 423 passed; zero fail/cancel/skip/todo |
| Node24 / PostgreSQL18 | 423 passed; zero fail/cancel/skip/todo |
| Native PDF, real hash-pinned Python runtime | 76/76 |
| Browser E2E, one worker, zero retries | 14/14 |
| Local pwsh Pester4.10.1 | 48/48; zero failures/skips |
| Focused CI/dependency/provenance contracts | 14/14 |
| Clean integration npm ci | 17 Windows packages, integrity verified |
| SQL checkout verifier | 11 exact HEAD blobs; no SQL blob changes |
| Cumulative git diff --check | Passed |

The full local matrix ran after the qualification fix at `0bdfc55`; the subsequent
`ff04e77` changes only workflow verifier ordering and has its focused GREEN above.
Local Python reused the dependency branch's clean hash-pinned venv; this is not a
claim of a newly built integration Python environment. Hosted CI performs fresh
hash-checked installs in all four matrix cells and Native PDF.

Initial Pester invocation passed 47 and failed one new test because its Describe
scope omitted dot-sourcing the helper. The fixture scope was corrected; final
48/48 is retained separately. No assertion was removed. Native PS5 module import
is restricted by the local host policy inherited from prior work; no bypass is
used. Both hosted Windows profiles remain mandatory.

Logs outside Git in parent `outputs/`: `f03-integration-{red,graph-red,green,
qualified-green,workflow-green}.log`, `f03-integration-final-node{22,24}-pg{16,18}.log`,
`f03-integration-pester{,-final,-committed}.log`, `f03-integration-native-pdf.log`,
and `f03-integration-browser.log`. Initial source branch reports remain preserved
as historical evidence, not claims that the combined tree inherits their CI.

Final delivery requires all five hosted workflows on the report commit's exact
HEAD, all four PostgreSQL cells plus aggregate, both Windows profiles, and actual
provenance archives matching committed dependency digests with qualified=true.
The final handoff supplies those run URLs and the read-only archive audit result.
No stale source-branch green result qualifies this integrated commit.

## Decision

GO for independent code review only after final-SHA hosted checks and artifact
verification succeed. Production remains NO-GO. No main/PR/settings/source-branch
update, production migration, deployment, service restart or cutover was performed.
Book production gate and human review behavior remain unchanged. Only the new
integration branch is published with a normal push; no PR or merge to a protected
branch is created.
