# PR #44 independent ADMINIT native containment review

Candidate commit `e72d7f1e438d3d8873eacad8fdfc6dd78553d7be`; declared tree `724134b6c61b34c54ef72e4119b5966148f48659` (not independently resolved). PR #44 is based on PR #41 `280096ab24ce4f32cdaf17bd4a928f66f4f2dbda`. This review branch is isolated.

## Source inspection

- `build-hosted.ps1` requires Windows PowerShell Desktop 5.1, github-hosted environment, committed source identity and strict git fsck; compiles immutable committed C# source via Add-Type into a Framework EXE. No SDK dependency is declared. No local ADMINIT build was executed.
- `AdminitSynthetic.cs` uses Win32 process handles and GetProcessTimes creation FILETIME, tests Medium integrity and non-elevated token, validates selected lab DACL writers, and captures root/leaf identities. No claim of filesystem/network confinement follows from this.
- `verify-adminit.ps1` explicitly refuses -Execute before package verification. The local execution gate remains CLOSED.
- `verify-native.mjs` requires exact five scenario inventory (normal, timeout, crash, assignment, cleanup), handle identity and explicit synthetic-only scope. It is an evidence validator, not native attestation.

## P0 / P1 / P2

**P0 BLOCKED**: physical execution admission; independent filesystem/network isolation not established. Job Object cannot substitute for OS sandbox/firewall policy. No host modification permitted.

**P1 BLOCKED**: actual descendant membership, nested Job Object behavior, last-handle kill-on-close, timeout, owner crash and independent watchdog require hosted native execution logs and five-case evidence, then separately approved physical acceptance. Native Win32 ABI/layout/FILETIME cannot be declared independently proven from static review.

**P1 REVIEW**: TOCTOU between path/ACL verification and execution; reparse/junction/hardlink checks, DACL inheritance and ownership must be verified at every relevant boundary. A preflight-only path check is not a security boundary against same-user concurrent mutation.

**P2 REVIEW**: evidence verifier must bind source HEAD/tree and exact binary/package hashes, all five cases, identity FILETIME, complete cleanup and no skips; independent provenance required.

## Read-only isolation acceptance criteria (design only)

1. Filesystem: identify approved read/write roots and deny list; compare before/after SHA256 inventories and ACL/SDDL snapshots; independently detect writes outside allowlist, hardlinks, junctions and reparse points. No untrusted executable launched during these checks.
2. Network: define explicit permitted destinations/protocols and deny-all default, independently inspect existing policy and collect passive connection/event evidence. Do not change firewall, proxy, routes, DNS or services.
3. Process: verify root/leaf job membership while suspended, handle-based creation FILETIME identity, no leaked job handles, descendant drain on normal/timeout/crash, and watchdog outcome independent of owner. No PID-only termination.
4. Evidence: exact SHA/tree, compiled EXE hash, Framework/PowerShell/OS versions, user SID/Medium integrity, five-case results, JUnit/JSON/manifest digests and independently verified logs. Any unknown or missing evidence is BLOCKED.

These criteria do not authorize native execution. ADMINIT Execute guard CLOSED, Q01 OPEN, production NO-GO. No merge, deployment, ACL/UAC/firewall/ExecutionPolicy/services/PostgreSQL changes or physical tests.
