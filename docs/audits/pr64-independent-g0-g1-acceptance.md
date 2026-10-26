# GPT-6 independent G0/G1 acceptance — PR #64

Date: 2026-10-26. **No rerun, full npm test, physical ADMINIT, production database, cancellation or merge.**

## Exact immutable identities

- PR #64 HEAD: `9094a68fe723e6618e6726f97d8a7df67a76d790`.
- Git commit tree: `6deee700d374a821cf09b4a4ed0eeb915f965e1f`.
- Base HEAD: `b24d2d6ca264926c1a65a96f574057192bfeca03`.
- Receiver run: https://github.com/YehorBabenko88/math/actions/runs/40307348580 — PR event, attempt 1, completed SUCCESS.
- Synthetic transport: https://github.com/YehorBabenko88/math/actions/runs/40307348709 — PR event, attempt 1, completed **FAILURE**.

## Receiver hosted test census (actual steps and logs)

| Job | OS / Node | Executed scoped tests | Skipped step |
|---|---|---|---|
| `121519618426` | Ubuntu 24 | 127 PASS, 0 FAIL, 0 SKIP | Normal receiver contracts for other branches |
| `121519618724` | Ubuntu 22 | 127 PASS, 0 FAIL, 0 SKIP | Same |
| `121519618865` | Windows 24 | 127 PASS, 0 FAIL, 0 SKIP | Same |
| `121519619019` | Windows 22 | 127 PASS, 0 FAIL, 0 SKIP | Same |

Total **508 PASS, 0 FAIL, 0 test SKIP**. This qualifies scoped pure receiver/collector contracts only. The skipped alternate step is not a PASS, and neither native models nor physical ADMINIT executed.

## Synthetic transport — exact failure

Collector job `121519619696` has one failing step: `Authenticate immutable collector inputs before requesting a bearer`. Fixed log code `PINNED_SYNTHETIC_QUALIFICATION_BLOCKED`, exit 1. The public allowlist upload step succeeded; this does **not** turn qualification into PASS.

Original artifact ID `12642078955`, name `synthetic-confidential-40307348709-1`, original ZIP SHA256 **`d1c0148f97eea94bd9dacb4bab507055e94e5f34021441ceb4596a012483b108`**, exactly matching the provided expected digest. One regular member `qualification.json` (284 bytes; SHA256 `a85ce10b3e7df63df10261d29f1dc19bd912892489347201b3c5ab3791692997`). JSON contains `schema=1`, `scope=SYNTHETIC_HOSTED_ONLY`, `status=BLOCKED`, `phase=STRICT_OIDC_OR_TRANSPORT`, `nativeAcceptance=BLOCKED`, `operationalAcceptance=UNQUALIFIED`, `physicalG1=BLOCKED`, `production=NO_GO`, `bookGate=CLOSED`, `q01=OPEN`. It contains no raw claims, keys, SID, PID, bearer or stack trace.

**Failure localization:** Source `hosted.mjs` sets phase `TRANSPORT` after OIDC request, then the worker can report `STRICT_OIDC_OR_TRANSPORT` on a failed `session.receive` check. The fixed phase does not isolate JWT signature, issuer claim, REST platform, timing, ZIP or transport as the exact cause. There is no public allowlisted diagnostic field to distinguish these cases in this artifact. Do not assert that collector immutable inputs themselves failed, or that OIDC is broken, solely from the enclosing step title. No relaxation of OIDC/ZIP/source checks is justified without independently controlled RED/GREEN evidence.

## Privacy and provenance

The collector log shows masked `QUALIFICATION_API_TOKEN=***`, an immutable collector SHA `fa9508b00d285c58a435b37a0a581f0f84b486b3`, fixed BLOCKED code and workflow script source. No raw token, SID, PID, private key, ciphertext or stack trace was observed in the bounded log review. Public artifact is a fixed allowlisted BLOCKED projection. This is not a universal leak-proof certificate and does not prove private custody or original evidence retention. Artifact name binds run/attempt; JSON lacks independent job ID, checkout SHA/tree, signature or real original evidence. These omissions are acceptable for a failure-only public projection but prohibit independent success attestation.

The reusable collector is pinned in caller YAML to `fa9508b00d285c58a435b37a0a581f0f84b486b3` both in `uses` and `collector-sha`. The loader performs commit/tree/blob digest checks before running a child; public BLOCKED phase is too coarse to attest exactly which private step was reached. No live bearer token or raw worker data was exposed for independent review.

## Existing independent security finding

At PR #64 HEAD, `verifyReceiverReceipt` still checks only signature plus selected closed-gate values, without exact signed-receipt field allowlist and without pinning all authorization-related status fields. This is a **confirmed source-level trust-envelope ambiguity**: a correctly signed receipt can contain extra `verified` or `Execute` fields while still satisfying the subset of checked fields. It does not demonstrate signature forgery or real authority escalation. The separate existing Draft PR #62 HEAD `b84a818f254fbf9a482406213bd56395aa4c5db0` already proposes an exact-field allowlist and status-value pinning with synthetic negative tests. Independently review and integrate that targeted fix if its RED/GREEN evidence passes; do not create redundant competing code patches or call it production-qualified.

## Decisions

| Gate | Decision |
|---|---|
| PR64 source SHA/tree | PASS |
| Receiver scoped contract tests | PASS 508/508 |
| Synthetic transport qualification | **FAIL / BLOCKED** |
| Public failure artifact integrity | PASS for original ZIP bytes |
| Independent signed real OIDC and private transport | NOT_QUALIFIED |
| Operational private collector/custody | BLOCKED |
| Q01 | OPEN |
| Physical G1 | BLOCKED / CLOSED |
| Production | NO-GO |
| Book gate | CLOSED |

**G0 operational NO-GO; G1 CLOSED.** No reruns or privileged operations. Send exact identities and this failure localization to Codex. Avoid interpreting artifact upload as successful qualification.

## Follow-up: bounded root-cause evidence, not a diagnosis by step title

Independent exact-HEAD inspection of `src/confidential-collector/{worker,session,oidc-client}.mjs` and `scripts/confidential-qualification/hosted.mjs` establishes: the public artifact contains no `diagnostics` field. The worker sets `phase=STRICT_OIDC_OR_TRANSPORT` for **any** exception in the `receive` handler; `SyntheticSession.receive` sets `diagnostics` only **after** successful `verifyOidcSignature`. Consequently, a missing diagnostics object is consistent with failure during sealed-envelope validation, platform/JWKS acquisition, or OIDC signature verification; it does **not** independently prove a specific OIDC claim or collector pin mismatch. A public log step named “Authenticate immutable collector inputs” is the encompassing step, not a precise exception location.

Suggested scoped RED/GREEN before any new hosted run: use synthetic token and fake platform fixtures to inject one failure per stage; assert distinct **fixed enum codes** for `SEALED_ENVELOPE`, `PLATFORM_CAPTURE`, `OIDC_SIGNATURE`, `OIDC_CLAIMS`, `ZIP_INVENTORY`, `REPLAY` while ensuring no exception strings, JWT, claims, key material, paths, or stack traces cross the worker/public-summary boundary. Avoid logging real claims or changing strict authorization predicates. The existing `BLOCKED` receipt is correct until a new independently reviewed, explicitly authorized qualification run succeeds. This recommendation is not a claim that such diagnostic changes or tests were executed.

The original ZIP was independently re-opened and its exact member inventory confirmed: one `qualification.json` of 284 bytes. ZIP SHA256 `d1c0148f97eea94bd9dacb4bab507055e94e5f34021441ceb4596a012483b108`. No hidden second member or original encrypted evidence is present. This failure artifact cannot establish job-level independent success binding.

## Scoped QA regression follow-up (2026-10-26)

Added `tests/confidential-pr64-blocked-projection.test.mjs`, picked up by the existing `tests/confidential-*.test.mjs` CI selection. It asserts that a synthetic failure projection cannot be modified into native/operational/physical/production/book GO, cannot contain extra token, stack, job ID or forged signature fields, and cannot accept arbitrary failure-phase text. It also guards that the pinned collector emits a fixed blocked code, returns nonzero on child failure, and only uploads a public allowlisted projection. This is **source and synthetic policy regression**, not a new successful hosted transport qualification. No full suite, real OIDC, rerun, ADMINIT or production operation was performed. The PR68 HEAD will need fresh scoped CI to claim test execution.
