# Disposable Windows process smoke — PREPARATION ONLY

Base PR86 `d102f579279f7f7496413999c64bc8058dae9ed3`. ADMINIT SECURITY HOLD. Physical runtime NOT_RUN. VM not provided; independent host controller absent. The Norton alert IDP.HELU.PSE95 is a reported observation, not proof of project causality or of a false positive. Do not disable, exclude, restore or retry around AV protections.

## What is implemented

One fixed process-only payload, a resource/observation manifest, an always-locked readiness CLI, and a pure trace-model checker with negative tests. The payload uses no imports, filesystem/network inspection, PowerShell, compiler, collector, harness or Token API. It writes exactly one fixed marker and exits; wrong platform/arguments exit2. It is not launched by tests or CI.

The production VM launcher and independent AV/isolation controller are **not implemented or available**. `readiness.mjs` always reports CONTROLLER_UNAVAILABLE, BLOCKED, NOT_RUN, irrespective of flags or environment. No public option loads a controller module, accepts a confirmation boolean, or opens phase2. Do not mistake the payload file's presence for authority to execute it directly.

`evaluateModelTrace` is explicitly a model: it cannot authenticate a host, establish isolation, enforce a resource limit, observe antivirus, terminate a VM/process or provide physical PASS. A complete fixture returns MODEL_SEQUENCE_ACCEPTABLE with physicalRuntime=NOT_RUN and attestation=NONE. STOP means a stop is required, not already enforced; stopEnforced is always false. Model timestamps are not wall-clock or host-attestation evidence. Replaying a model trace does not consume any real launch authorization.

## Operator procedure before any real execution

1. Obtain a separately provisioned disposable Windows VM through the responsible lab operator. Do not change ADMINIT, historical labs, PostgreSQL, production systems or security settings. No VM provisioning/configuration changes are automated by this proposal.
2. Independently inspect the VM **from the host**. Record private custody and fresh immutable configuration evidence. The guest must have no production credentials, production datasets, mounted production disks, shared host folders, clipboard/drive redirection or unintended guest-integration/IPC paths. Inspect all virtual NICs, host-only/bridged/NAT/vSwitch routes, IPv4/IPv6, host-to-guest and loopback paths, metadata/service channels and snapshot contents. Unknown paths are BLOCKED. Guest environment variables or a text declaration are not independent evidence.
3. Provide a dedicated non-administrative guest account and an accepted launch mechanism that establishes a non-elevated context. Independently verify the launch account/token custody without invoking the project's Token API payload. A trusted host broker may need OS security APIs internally; the stage-one candidate payload itself must not invoke Token API v2 or any token-observation script. Account configuration alone does not prove the actual child context. Do not rely on host elevation or the caller shell's identity as child evidence.
4. Provide and independently accept the external security controller. It must authenticate its observation channel, verify fresh host configuration and AV-provider health, detect missing/stale/reordered telemetry and retain a monotonic host clock. AV must remain enabled with an accepted policy/signature state. Silence, unknown provider state or stale definitions are not CLEAR. No protection changes/exceptions are allowed. No such controller/receipt exists in this PR.
5. Independently verify exact candidate HEAD/tree, all source/package hashes, fixed payload hash, the Node executable/version and the manifest. Expected values must come from trusted review, not merely the same guest reporting its own values. Manifest sourceBase is historical ancestry; candidate HEAD/tree must be supplied independently after this PR is committed. Copying the model fixtures is not evidence.
6. Independently review the host-side enforcement adapter. Before Resume it must place the child in an accepted Windows Job Object with active-process limit1, job memory256MiB, job CPU-time1000ms, no breakaway and KILL_ON_JOB_CLOSE; retain independent process/job handles. Set V8 heap32MiB as an additional **soft component limit**, not a substitute for total-process memory. Use only the pinned Node executable, fixed flags and payload. No arbitrary commands, scripts, environment preload hooks or alternate executables.
7. The host controller must atomically consume a single-use attempt in a durable ledger **outside guest snapshot rollback** before launch. Bind it to candidate SHA/tree, payload/Node/limits hashes and private VM custody. Replay, crash and restart must never retry or mint another attempt automatically. A failed or uncertain launch consumes the authorization. This ledger/adapter is absent, so execution remains BLOCKED.
8. Only after steps1–7 have independently accepted evidence may the operator separately approve **one stage-one process-only attempt**. No consent is implied by this procedure, a model result, CI, previous G0 permission, or a generic continue request. Do not supply credentials/keys in chat or public artifacts.

## One allowed future phase-one attempt

The independently accepted controller, not this repository's CLI, launches the fixed payload. Wall time≤2000ms; stdout≤128bytes; stderr must be empty; only one process/start; marker hash and exact byte length must match the manifest; child exit0 required. No retries, stress loops, service queries, database access, installation or source compilation are part of this smoke.

The controller must collect fresh AV/isolation/resource coverage at intervals≤100ms, declare a gap if coverage exceeds250ms, and keep observing for at least1000ms after exit. Exact bounds are in manifest.json. These numbers are proposed limits, not already-qualified operating-system enforcement. Transport is bounded to128 normalized frames, each≤1024bytes. Record source SHA/tree, fixed error-stage and actual exit status separately. Raw stdout/stderr, user/VM identifiers, SID, PID, handles, paths, provider detail and raw OS errors remain in approved private custody only; publish fixed classifications and SHA256 evidence.

The1000ms post-exit window is **not an AV delivery guarantee**. Before admitting any launch, independently qualify provider visibility, delivery latency, event continuity/watermarks and health. Continue monitoring until the attempt is independently closed; a delayed alert remains STOP. If coverage or delayed-event handling cannot be established, the attempt is BLOCKED. The model treats sampling later than100ms as STOP even when below the250ms hard-gap threshold; it does not prove actual sampling or protection health.

On **any** AV alert, unknown/lost protection, observation gap, isolation change, resource enforcement loss, source drift, timeout, output anomaly, unexpected exit, duplicate start or uncertain handle reaping: immediate STOP/BLOCKED. The independent controller must terminate the job, confirm all children through retained handles and stop/freeze the VM if cleanup cannot be confirmed. Preserve private evidence. No close-and-retry, AV exception, relaunch, snapshot replay or automatic recovery. The model checker only requests STOP; it cannot perform these actions.

## STOP / GO interpretation

| Condition | Decision |
|---|---|
| Current state: VM/controller missing | BLOCKED; physical runtime NOT_RUN |
| Authenticated host evidence, custody or protection incomplete | STOP/BLOCKED before launch |
| Any alert/gap/isolation/resource failure, even after child exit | STOP/BLOCKED; no retry |
| Exact fixed output/exit, one launch, verified reaping, complete protection coverage | Stage-one evidence **eligible for independent review**, not physical admission |
| Independently accepted phase-one evidence | May request a **separate** phase-two authorization; never automatic GO |

## Phase two — not implemented, not authorized

Only after independent acceptance of real phase-one evidence and new explicit approval may a separate reviewed implementation perform exactly one read-only Token API v2 observation in a fresh non-elevated process. Bind exact source/runtime identity and retain all existing UNKNOWN/error/cleanup precedence and authority=NONE/admission=BLOCKED/localExecute=false/isolationConfirmed=false. Producer and validator exit2 remain expected. No phase-two invocation is present in this PR. Its process containment/AV monitoring and one-use approval must be accepted separately; this document is not that approval.

## Honest acceptance matrix

| Item | Current evidence |
|---|---|
| Payload/manifest and protocol model | Source review and pure Node tests only |
| VM/account/production isolation | NOT_PROVIDED / UNVERIFIED |
| Independent AV/gap-aware host controller | ABSENT / BLOCKED |
| Actual Job Object/resource/reaping enforcement | NOT_RUN / NOT_IMPLEMENTED here |
| Actual process-only payload | NOT_RUN |
| Token API v2 phase two | NOT_RUN / NOT_AUTHORIZED |
| ADMINIT | SECURITY HOLD; no new diagnostics/execution |

Q01 OPEN · Physical G1 BLOCKED · Production NO-GO · Book gate CLOSED. No merge or deployment.
