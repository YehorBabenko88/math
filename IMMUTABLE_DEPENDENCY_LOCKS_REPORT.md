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

GREEN: six automated negative/positive tests cover missing lock, root dependency/version/optional/peer drift, missing integrity/registry URL, Python version/hash/closure drift, and mandatory install flags. Existing CI contract tests also pass (10 combined tests). Clean npm install succeeded twice under Node 24 and once under Node 22 (17 packages on Windows); lock SHA256 remained `a42107ca96471199bfe4edb97fe63c94002387fdf3132604eece59ce28384421`. All 17 previously installed sibling package versions were preserved; optional Darwin fsevents 2.3.2 was added to complete the cross-platform lock. Own node_modules was installed, not copied.

Own clean Python venv installed all three hash-approved Windows wheels. pip resolved/downloaded the complete Linux wheel graph under `--require-hashes --only-binary=:all:` with explicit CPython 3.12/manylinux x86_64 tags. No dependency versions were upgraded. Linux execution is established only by exact-head Actions, not the local Windows download. Browser: all 14 tests passed using isolated port 4184.

Local npm initially rejected this environment's TLS issuer. Enabling Node 24 `NODE_USE_SYSTEM_CA=1` used normal OS certificate trust; certificate checking was never disabled. Subsequent Node 22 clean install used verified npm cache in offline mode.

## Boundaries and go/no-go

All 11 historical SQL files remain byte-identical to the base; no SQL changes. No production database, services, deployment, branch settings, source PR, merge, or force push was touched. The npm lock uses `.gitattributes -text` so checked-out bytes equal the committed blob across Windows/Linux.

GO for review of npm/Python artifact locking on the documented platforms, conditional on final exact-head mandatory Actions and local full matrix evidence. NO-GO for claiming universal Python/platform, browser/runtime, Actions, or complete release immutability. Full matrix and final Actions evidence are appended before final delivery.
