# GPT-5 — PR #44 Git provenance and supply-chain audit

Date: 2026-10-25. Independent Draft, based on PR #44 exact HEAD `e72d7f1e438d3d8873eacad8fdfc6dd78553d7be`.

## Exact candidate HEADs
- PR #24: `94cb8d753c0e429aef33f868593a402b39ad1354`
- PR #31: `cb168925b5aeec0c957137dd94ab72c64f0bd333`
- PR #36: `42b930cd1c34ccf9023e7ca2c8a1d30ec08a6523`
- PR #40: `8ec4d1e2fe14ba917c715bf6e44465ea31dd50e7`
- PR #44: `e72d7f1e438d3d8873eacad8fdfc6dd78553d7be`

These HEADs were read from GitHub PR metadata. Git tree OIDs were NOT independently returned by the connector and are NOT_VERIFIED; do not infer tree from commit SHA.

## Confirmed observations
1. `build-hosted.ps1` uses `git --no-replace-objects`, `fsck --strict`, and compiles the three C# inputs read from committed Git blobs with `git show`. It performs pre/post tracked-source checks. These are positive static controls, not independent runner attestation.
2. `verify-build-inputs.mjs` previously parsed the Git blob OID but discarded it, and its pure validator accepted entries without any blob OID. The new patch captures and checks 40-hex Git SHA1 object IDs. Three negative tests reject missing, abbreviated and 64-hex substituted OIDs.
3. `package.mjs` checks a two-file inventory, bounded executable size, SHA256, literal path and link constraints. The expected manifest SHA256 is a parameter. It does not prove where that expectation came from, nor preserve an immutable open handle between verification and later execution.
4. Hosted workflow computes the manifest digest from its own just-produced package. This is producer integrity evidence, NOT independent out-of-band approval. The package verifier's result MUST NOT grant Execute.
5. `verify-adminit.ps1` unconditionally rejects `-Execute`, checks non-elevated token, paths and ACLs, and does not run the package executable. No ADMINIT run authorized.
6. `verify-native.mjs` validates synthetic outcome structures, but its report is still supplied by the producer; hosted tests do not prove physical ADMINIT acceptance.

## Priorities
- P0: Never promote hashes, signatures, manifest or self-reported receipts to Execute/VERIFIED. Keep localExecution BLOCKED, Q01 OPEN and Production NO-GO.
- P1: Trusted out-of-band manifest digest and source commit/tree binding; independent package provenance and Git object-format resolution; close TOCTOU via isolated immutable staging/handle-based verification before any separately authorized execution.
- P1: independently check package archive extraction against traversal, symlink, hardlink, reparse and alternate data stream attacks. Current package is a directory; no archive extraction contract is proved.
- P1: bind CI evidence to exact HEAD/tree/run/attempt/job and verify all expected artifacts and their digests, with external trusted expected values.
- P2: full inventory manifest and reproducible toolchain identity, repeated race and stale-artifact negative tests.

## Execution ledger
- EXECUTED: GitHub PR metadata, source and workflow inspection, patching separate branch.
- TESTS AUTHORED: three negative Git blob-ID regressions.
- NOT_RUN: independent local Node matrix, Windows host, ADMINIT, package delivery/extraction, physical acceptance, production.
- CI PR #44 at audit time: eight workflows queued; no PASS inferred.
- Tree IDs: BLOCKED / not independently resolved.
- GO/NO-GO: NO-GO for independent package execution and production.

## Codex contract
Keep changes in a Draft branch from exact PR #44 HEAD. Validate Git commit/tree object format and source bytes independently, disable replace objects, compile only verified committed blobs, check exact input modes and blob OIDs. Treat package SHA256 as integrity only. Require an external approved digest and immutable staged package before a separately authorized execution gate. Preserve `-Execute` unconditional refusal. Do not touch PR #31, main, ADMINIT, production databases or physical machines.
