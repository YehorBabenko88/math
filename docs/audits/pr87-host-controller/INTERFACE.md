# External Windows VM host-controller interface — NOT ACCEPTED

Base: PR87 exact `a7af248da5e96222186fe550cea9d5a8386eb0fb`. VM, independent host-controller acceptance, AV collector, live launcher and nonrollback storage backend remain absent. ADMINIT SECURITY HOLD. This PR adds interface validation only; no process, Token API, Job Object, hypervisor, security product or database is invoked.

## Trust boundary

`checkHostEvidence(envelope, policy, receiverNowMs)` verifies a bounded canonical JSON envelope and an Ed25519 signature against an **externally pinned** public key/fingerprint and expected host/VM/source/ledger context. No key or acceptance policy is generated in production code, loaded from guest environment, or stored in Git. Ephemeral keys in unit tests are synthetic and never exported as host-attestation evidence.

The policy must come from independent host-controller acceptance and private custody, never the same guest/sender reporting its own expectations. A valid signature proves possession of a key; it does not prove truthful observation, trusted hardware, isolation or controller acceptance. Proof digests merely bind privately retained evidence. This implementation does not fetch or assess that underlying evidence. `PASS` means **CONTRACT_ONLY**, not physical PASS or launch permission. Host/VM digests, public keys, nonces and private source data are never copied into the public result.

`lockedHostResult()` always returns NOT_RUN / HOST_ACCEPTANCE_MISSING / LIVE_GATE with authority=NONE, admission=BLOCKED, localExecute=false, isolationConfirmed=false, physicalRuntime=NOT_RUN and phase2=BLOCKED. `readiness.mjs` uses this gate. No flag, callback, boolean, valid envelope or environment variable unlocks a launcher. There is no launcher implementation.

## Closed evidence envelope

The payload is canonical `JSON.stringify(object)`, ≤16KiB, with a canonical64-byte base64 Ed25519 signature. Duplicate fields, unknown/private keys and mixed schemas fail closed. Time values are nonnegative safe integer milliseconds from the independently accepted receiver/controller clock mapping; never trust the guest's clock. The receiver checks issuance, expiry (maximum5seconds), sample age and pinned watermark cursor. Clock mapping and rollback detection are physical acceptance prerequisites, not proven by the function's timestamp parameter.

Exact fields are defined and validated in `scripts/runtime-smoke/host-controller-contract.mjs`; phases PRELAUNCH and COMPLETION have separate invariants:

- **Identity/source:** external controller-key fingerprint, host and VM identity digests, HOST_CONTROL_PLANE collection, private evidence digest; exact source HEAD/tree, payload/Node SHA256 and one-attempt nonce digest. Guest self-reports are rejected. Identity measurement and key custody remain independently unqualified.
- **Network coverage:** all14 facets must be explicitly ISOLATED: IPv4, IPv6, virtual NICs, virtual switches, host routes, host/guest loopback, shared folders, clipboard, guest integrations, virtual sockets/pipes, host storage, cloud metadata and production credentials. Missing or UNVERIFIED facets block. No connectivity probe or production endpoint is contacted. These are signed controller claims, not established enforcement.
- **Standard User:** STANDARD_USER, elevated=false, adminEnabled=false, BROKER_BOUND launch context and a proof digest. A caller shell/account label is insufficient. The actual child token and broker custody must be independently qualified; this validator never queries a token.
- **AV:** enabled/healthy provider, accepted signatures, proof digest, alert=NONE, lostEvents=0, sample age≤100ms and watermark lag≤100ms relative to that sample, strictly advancing watermark sequence relative to the receiver's pinned cursor, bounded provider delivery latency (1–1000ms), continuous coverage start. Thus watermark age can be up to200ms at claims validation; request preparation independently requires absolute watermark age≤100ms. Cursor persistence, authenticated transport, provider visibility and event loss detection remain required external implementation. Silence is not CLEAR.
- **Ledger:** expected storage identity, exact generation, HOST_NONROLLBACK placement, snapshotExcluded=true, evidence digest and UNRESERVED/SPENT state by phase. None of those fields proves physical storage placement or durability; independent backend acceptance is mandatory.
- **Job:** assignment BEFORE_RESUME, KILL_ON_JOB_CLOSE, no breakaway, active process limit1, memory256MiB, CPU1000ms, wall2000ms, stdout128bytes/stderr0, independent host watchdog, retained-handle reaping and evidence digest. No native enforcement is performed here.
- **Completion:** exactly one launch, exit0, exact fixed marker byte count/hash, empty stderr, assignment sequence before resume sequence, ordered timestamps and bounded wall time, retained-handle reaping after exit with zero remaining processes, AV continuous coverage preceding assignment and watermark through exit. Equal millisecond assignment/resume timestamps are allowed only with strictly ordered sequence numbers. Continuous observation/gap detection and actual handle ownership still need an accepted controller.

Any alert, telemetry loss, unknown protection/isolation, stale/reordered watermark, limit mismatch, expired evidence or uncertain cleanup yields BLOCKED. A new packet may reveal a delayed alert after a previous contract PASS; the live host must continue monitoring and revoke/stop immediately. No finite sample or1000ms window proves all future alerts absent. The live gate remains closed throughout this PR.

## Host-only single-use ledger wire contract

`prepareLedgerRequest(reservation, receiverNowMs)` accepts only an opaque PRELAUNCH validation record from the verifier. It rechecks monotonic time, expiry and AV/watermark freshness at request preparation. Any use burns the local opaque record, including an invalid/stale call; it cannot be rewound by supplying an earlier time afterward. A fresh revalidation of the same nonce produces the **same** idempotency key. This is request construction, not global deduplication or durable consumption.

The returned request is private wire data: pinned ledger identity, generation, attempt nonce, source-envelope binding, expiry and idempotency digest. No filesystem path or guest-selected storage root is accepted. The request result is NOT_RUN / HOST_LEDGER_BACKEND_MISSING. No filesystem/DB operation, durable reservation or host-attestation record occurs. In-process ticket state is explicitly not crash durable.

The separately accepted external backend must:

1. Authenticate the requesting controller/receiver, verify the original signed context and current source/AV/generation. A digest or this unsigned request alone is not authorization.
2. Atomically consume the nonce in the pinned host storage realm **outside all VM snapshots/rollback**, with a unique idempotency key independent of generation changes. Reject binding conflicts, stale epochs and attempts to move to another storage realm. Return the identical consumed outcome to an identical retransmission; never mint a second launch grant.
3. Flush the record and required metadata to accepted durable storage before any process creation/resume. Crashes before/after commit and unknown responses must never permit retry with a new key automatically. Empty/corrupt/partial records block. Preserve an irreversible SPENT state even when AV, launch or cleanup fails.
4. Prove exclusive host-service ownership and directory/transaction identity, using accepted handle-relative/native or transactional primitives. Path-based lstat/open and a guest-reported boolean do not establish this. Windows flush semantics, retention, corruption recovery and storage snapshot exclusions require real qualification.
5. Retain authenticated private receipts and a nonrollback AV cursor. There is no reset/release/expiry-reuse operation in the proposed protocol. New attempts require new explicit operator approval and independent review.

A first Node path-based reference writer was rejected during review: ticket placement/freshness were insufficiently bound and path replacement could redirect writes. A stale-ticket side effect was reproduced with isolated synthetic files (RED). The writer was removed completely rather than claim unsupported Windows durability/ownership. The current module imports no filesystem API and cannot write a ledger. This is an intentional architectural blocker, not a production ledger implementation hidden behind PASS.

## Acceptance and required physical work

Unit tests exercise contracts with temporary in-memory signing keys; no real envelope or host identity is claimed. Ledger tests check bound requests, stable idempotency, local single-use and stale/backward-clock refusal; they do not test global races, storage crash durability or VM rollback. No fake physical PASS or host-attestation artifact is emitted.

Before one real process-only attempt: independently provide/accept the disposable VM, non-elevated broker context, full network/shared-integration configuration, external controller identity/key custody, AV health/coverage/latency channel, durable host ledger and real Job Object/watchdog/reaping adapter. Require a new explicit single-attempt authorization. Do not infer it from code review, signature validation, CI or model data. Do not run anything on ADMINIT, alter protection/settings, access production, perform Token API/G1 or merge this PR automatically.

Q01 OPEN · Physical runtime NOT_RUN · ADMINIT SECURITY HOLD · G1 BLOCKED · Production NO-GO · Book gate CLOSED.
