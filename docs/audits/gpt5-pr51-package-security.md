# GPT-5 independent PR #51 provenance and package acceptance

Source candidate PR #51 HEAD: `878c178bcf6d068f552f4c642820f42cad9a43a9`. Base: `88c4ce4d2880ec9d8dab96573fd37fb08720b2c5`. GitHub connector commit metadata did not independently expose the candidate tree; treat exact tree as NOT_VERIFIED until resolved from trusted Git objects.

## Verified from code
- Package directory inventory is exactly `AdminitSyntheticHarness.exe` and `package.json`; executable bytes and manifest bytes are SHA256 checked; manifest size <= 16 KiB and executable <= 16 MiB.
- Literal absolute directory, canonical path and ancestor symlink/hardlink checks exist. Package manifest executable name is fixed; malicious traversal metadata is rejected.
- `expectedSourceTree` was optional in the original verifier. Therefore an otherwise valid package could pass without independent tree binding. Added `verifyAdminitPackageQualified` requiring an externally supplied 40-hex source tree; it returns `SOURCE_TREE_BOUND_ONLY` and `execution: DENIED`. Existing legacy API remains explicitly unqualified for backward compatibility.
- Expected manifest digest and source IDs are supplied by the caller; their independent origin is not established by the package verifier. A producer computing its own digest is not external attestation.
- A point-in-time path check does not close TOCTOU if a writable directory is modified before later execution. No execution authorization is provided.
- PR #51 hosted workflow runs were queued when inspected; no job success or ZIP artifact availability claimed.

## Independent ZIP verification contract (not yet implemented)
1. Obtain expected HEAD/tree and expected package SHA256 from a separately trusted approval channel. Reject producer-provided expectations as authority.
2. Bind workflow repository, event, exact HEAD/tree, run ID, attempt, job ID and artifact ID to provider metadata. Refuse missing, stale or cross-attempt evidence.
3. Download ZIP as untrusted bytes into fresh isolated storage. Verify independently supplied ZIP SHA256 before parsing.
4. Inspect central directory and local headers; reject duplicate/ambiguous names, absolute paths, drive/UNC prefixes, traversal, backslash confusion, ADS, NUL, Unicode-normalization collisions, symlinks, hardlinks, device nodes, reparse attributes, encryption and unsupported compression.
5. Bound total and per-entry uncompressed bytes, compression ratio, entry count and nesting; refuse any unexpected member.
6. Extract only to fresh, private directory using no-follow and exclusive creation. Reject pre-existing paths, race-induced substitutions and hardlinks.
7. Verify extracted package exact inventory, independently expected manifest SHA256 and executable SHA256. Preserve an immutable staging boundary until separate authorized execution.
8. Signed evidence and hash matches prove byte identity, not execution authorization or mathematical VERIFIED. Execute remains DENIED.

## Priorities and status
P0: no automatic Execute/VERIFIED; physical ADMINIT and production NO-GO; Q01 OPEN.
P1: require external source-tree binding for qualified evidence (patched); independent ZIP digest source, ZIP secure extraction and TOCTOU protection remain BLOCKED.
P1: independent provider run/attempt/job/artifact binding remains BLOCKED until actual hosted artifacts and job evidence can be checked.
P2: additional negative ZIP fixtures and cross-platform filesystem/ACL tests.

EXECUTED: GitHub PR/CI and source inspection, code and negative tests authored in isolated Draft branch.
NOT_RUN: local Node matrix, actual ZIP extraction, native/physical ADMINIT, production.
PASS: static presence of exact inventory, path checks and SHA256 code.
BLOCKED: end-to-end provenance, actual ZIP safety and execution acceptance.
