# Independent GPT-5 AI/Codex acceptance — PR #31

Candidate commit: `cb168925b5aeec0c957137dd94ab72c64f0bd333`.
Candidate tree (from PR metadata, independently revalidate): `10cfd29f5d2c75e841d88dd70bef8773dada8287`.
Source PR #24: `94cb8d753c0e429aef33f868593a402b39ad1354`.

## Observed facts
- PR #24 accepts 40/64-character lowercase Git object IDs for source commits while preserving 64-character SHA256 for artifact/receipt/toolchain hashes.
- `inspectOfflineEvidence` returns NOT_VERIFIED and DENIED. `claims.mjs` returns UNATTESTED_CLAIM.
- `kernel-result-boundary.mjs` returns AUTHENTICATED_RESULT_ONLY; that is not VERIFIED or release authorization.
- `registry.mjs` provides SQLite uniqueness, not runner authentication, signed immutable receipts or trusted sandboxing.

## Remediation in this draft
`pinned-source.mjs` is a pure repository-scoped syntax/format check for an exact commit+tree pair. It rejects mixed Git object formats, wrong repository, and abbreviated IDs. For the currently known SHA1-format YehorBabenko88/math repository it now also rejects a caller's SHA256-format declaration even when both supplied IDs are 64 hex. It does not read Git objects, authenticate provenance, verify signatures, or authorize execution. The trusted intake MUST independently resolve Git object format, commit/tree bytes and repository origin before relying on this contract. Artifact digests must remain SHA256 and MUST NOT be interpreted as Git IDs.

## Acceptance gates
P0: independently attest commit/tree identity and trusted runner; prohibit LLM self-attestation, arbitrary code execution from books, production credentials and automatic publication.
P1: signed and replay-protected receipts bound to task, attempt, artifact bytes, runner image, toolchain, proof kernel and exact tree; isolate Codex workers by OS-level sandbox, network deny, writable mounts allowlist and quotas.
P1: Q01 OPEN; no production SQLite queue assumption.
P2: budget telemetry, fault injection, portability and operational documentation.

## Execution evidence
Source inspection via GitHub connector: EXECUTED.
Hosted CI: results are asynchronous and require exact HEAD recheck.
Local Node/Windows/PG matrix: NOT_RUN here.
Physical execution/deployment/merge: NOT_RUN and prohibited.

## Integration plan
1. Independent review of this Draft and PR #24; exact tree comparison.
2. Run isolated Node22/24 pure tests and full Windows/Linux + PG16/18 matrix on exact SHA, reject skips as PASS.
3. Trusted intake resolves source object IDs and artifact hashes separately.
4. Sandboxed executor emits signed immutable receipts into a trusted replay ledger.
5. Independent kernel validates proof objects; authenticated results alone never confer VERIFIED.
6. Human owner authorizes any release with a separate signed approval bound to exact artifacts.
7. Keep production and book gates CLOSED until Q01 and physical preflight are independently accepted.

## Follow-up audit and isolated execution
A follow-up found a format-substitution hole in the initial helper: the fixed SHA1 repository name could be combined with an attacker-declared SHA256 object format and two 64-character IDs. The helper now refuses any objectFormat other than sha1 for this known repository; this is still a local syntax policy, not an independently resolved Git object.

Isolated Node.js 22.16.0 test run: 6 PASS, 0 FAIL, 0 SKIP (a minimal local reconstruction of the exact helper and test source fetched from GitHub, **not** a full repository checkout). Full PR CI and other platforms: NOT_RUN in that isolated environment. Hosted CI must be checked at the new exact HEAD; no production or physical operation was attempted.
