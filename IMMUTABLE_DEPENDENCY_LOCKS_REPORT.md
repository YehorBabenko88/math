# Immutable dependency locks report

Base: `8dd1186f3fc34fa0148eb137cb44fc2416321e7c`. Branch: `fix/immutable-dependency-locks`. The final published commit is the commit containing this report (resolve with `git rev-parse HEAD`); remote workflow results are reported separately against that exact SHA.

## Findings and changes

- P0: None established by this dependency audit.
- P1 fixed: no committed npm lock existed. Exact direct versions did not pin transitive artifacts; mandatory browser/PostgreSQL jobs used `npm install`. Added npm v3 lock with registry URLs and SHA512 integrity, fail-closed manifest/artifact validator, and `npm ci --ignore-scripts --no-audit --no-fund` in every npm install path. Mandatory general/PDF/browser/PostgreSQL workflows validate locks before consuming them.
- P1 fixed: Python requirements pinned versions but accepted any artifact for those versions. SHA256 allowlist now covers the three existing versions, five unique reviewed wheels, CPython 3.12 Windows amd64 and glibc Linux x86_64. Mandatory pip installs require hashes and wheels. Unsupported platforms fail rather than build an unreviewed source distribution.
- P2 residual: npm/pip versions, Node/Python runtime patches, Playwright browser download, Actions tags, OS images, and Pester package acquisition are not made immutable here. This branch alone does not establish complete supply-chain or release immutability. Action/provenance work belongs to the separate branch; no merge was performed.
- P3: dependency updates must change the reviewed root/version policy and lock explicitly. Hashes authenticate selected bytes against this reviewed repository allowlist, not package safety or publisher identity.

## Red / green evidence

RED: new dependency contract initially failed because the verifier and committed lock were absent. Actual isolated `npm ci` with manifest pg 8.16.2 against lock pg 8.16.3 exited 1/EUSAGE, explicitly reporting mismatch. An extra unapproved dependency also failed. Actual pip download with a zeroed pypdf SHA256 exited 1 with expected/actual hash mismatch. These fixtures were outside tracked source.

GREEN: six automated negative/positive tests cover missing lock, root dependency/version/optional/peer drift, missing integrity/registry URL, Python version/hash/closure drift, and mandatory install flags. Existing CI contract tests also pass (10 combined tests). Clean npm install succeeded twice under Node 24 and once under Node 22 (17 packages on Windows); after canonical LF normalization lock SHA256 is `944b7dcca798cb8e6fd257a89c67ab2cd619fb53fcb9952cd7761b6d1b33f523`. All 17 previously installed sibling package versions were preserved; optional Darwin fsevents 2.3.2 was added to complete the cross-platform lock. Own node_modules was installed, not copied.

Own clean Python venv installed all three hash-approved Windows wheels. pip resolved/downloaded the complete Linux wheel graph under `--require-hashes --only-binary=:all:` with explicit CPython 3.12/manylinux x86_64 tags. No dependency versions were upgraded. Linux execution is established only by exact-head Actions, not the local Windows download. Browser: all 14 tests passed using isolated port 4184.

Local npm initially rejected this environment's TLS issuer. Enabling Node 24 `NODE_USE_SYSTEM_CA=1` used normal OS certificate trust; certificate checking was never disabled. Subsequent Node 22 clean install used verified npm cache in offline mode.

## Boundaries and go/no-go

All 11 historical SQL files remain byte-identical to the base; no SQL changes. No production database, services, deployment, branch settings, source PR, merge, or force push was touched. The npm lock uses `.gitattributes -text` so checked-out bytes equal the committed blob across Windows/Linux.

GO for review of npm/Python artifact locking on the documented platforms, conditional on final exact-head mandatory Actions and local full matrix evidence. NO-GO for claiming universal Python/platform, browser/runtime, Actions, or complete release immutability. Local full matrix below is complete. Final exact-head Actions are checked after publication and returned with their URLs; they cannot be embedded in their own triggering commit without changing that SHA.

## Reviewed wheel artifacts

- `pillow-12.3.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl`: `78cb2c6865a35ab8ff8b75fd122f6033b92a62c82801110e48ddd6c936a45d91`
- `pillow-12.3.0-cp312-cp312-win_amd64.whl`: `a2b55dd6b2a4c4b7d87ffa56bdb33fdc5fdb9a462173861a7bc097f17d91cb09`
- `pypdf-6.20.1-py3-none-any.whl`: `aa5a55ddcffdc5e5ab291d5decb23f6383f4e56f8e3263dc39af41fff03885ad`
- `pypdfium2-5.14.0-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl`: `11f281613fa22313d9c7ab89947665e84eccf8ebe40e1198a84a88352305648d`
- `pypdfium2-5.14.0-py3-none-win_amd64.whl`: `149fd5c6397b8df8bf7911a93506eff0be874f877afe7ac936cf5d37d21a6a06`

Initial publication `2f99e6987500fc91de3c60acc0c475100b3140d4` exposed invalid unquoted YAML pip commands containing `:all:` in the PDF/PostgreSQL workflows. Those commands are now quoted; initial failed Actions were not rerun or hidden. Local PyYAML was unavailable, so final GitHub workflow parsing/execution is the authoritative YAML check.

PowerShell 7 Pester 4.10.1: 39 passed, zero failures/skips. Windows PowerShell 5 execution remains blocked by local policy; no policy bypass was used. Both shells execute in mandatory remote Actions.

## Complete local matrix

Unfiltered `scripts/test-full-ci.mjs`, own clean hash-pinned Python venv, disposable parent-owned PostgreSQL only: Node 22.23.3 / PG16: 415 passed; Node22 / PG18: 415 passed; Node24.20.0 / PG16: 415 passed; Node24 / PG18: 415 passed. Every run had zero fail/cancel/skip/todo. Each used the authoritative full inventory (403 root subtests, 415 total tests). This is Windows-local evidence; final Linux matrix and both remote PowerShell shells are evaluated through exact-head Actions.
