# PR60 Windows native independent negative evidence

Base exact HEAD: `b24d2d6ca264926c1a65a96f574057192bfeca03`. Source PR51 HEAD `878c178bcf6d068f552f4c642820f42cad9a43a9`; PR56 HEAD `920fd4977192bdd29606cb58d193fc7998a1c862`. Git tree IDs remain **UNVERIFIED** through this connector; do not infer them from PR descriptions.

## Scope and priorities
- **P0 BLOCKED**: actual Windows nested Job Object ownership, kill-on-close after owner crash, zero surviving descendants, independent private evidence and physical admission. Never infer native PASS from synthetic model PASS. ADMINIT Execute guard CLOSED; production NO-GO; Q01 OPEN.
- **P1 REVIEW**: `WaitForSingleObject` returns raw status; `0` is success, `258` timeout, `0xffffffff` failure, all other codes invalid. Forced watchdog evidence requires status BLOCKED, live before expiry, outer cleanup confirmation and signalled owner/root/leaf handles with identity. This branch adds 11 fail-closed negative mutations. No runtime source changed.
- **P1 BLOCKED**: bootstrap 120s and PowerShell 150s watchdog require actual exact-head hosted logs, owner handle exit and independently confirmed descendant drain; root-only WaitForExit is insufficient.
- **P2 REVIEW**: producer-local JSON schema validation is not independently authenticated acceptance; bind exact SHA/tree, run/attempt/job, artifact bytes and negative proofs before acceptance.

## Tests and CI
At PR60 exact HEAD the following workflows completed success: Book Ingestion Native PDF 40298775044, Validate Math Universe 40298775177, Q01 Windows Containment Preparation 40298775083, Windows Deployment Contracts 40298775087, Confidential Evidence Receiver Contracts 40298775250, Q01 Queue Reliability 40298775089, Browser E2E 40298775129. PostgreSQL Integration 40298775080 completed **FAILURE**. Do not call aggregate CI green.

New negative tests are **NOT_RUN** until CI on this branch is inspected. No native EXE, ADMINIT, physical host, firewall, ACL, services, UAC, deployment or production operations performed.

## Native admission criteria
1. Five native cases (normal, timeout, crash, assignment, cleanup) independently evidenced, plus forced watchdog negative outcome BLOCKED.
2. WAIT_FAILED, WAIT_TIMEOUT and unexpected wait codes fail closed with no leaked handles or survivors.
3. Parent/child creation FILETIME and handle identity, inner/outer membership before Resume, last-handle kill-on-close, and independent watchdog 120/150s boundaries proved.
4. Independent zero-descendant proof using OS process/job accounting and no unknown handles; filesystem/network isolation separately reviewed, not inferred from Job Object.
5. Any skipped, missing, private receiver unavailable, or stale evidence remains BLOCKED. No physical gate without separate authorization.
