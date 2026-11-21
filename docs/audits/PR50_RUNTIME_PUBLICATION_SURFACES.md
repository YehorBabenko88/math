# Runtime publication surfaces — independent of tracked documents

Source baseline PR50 `88c4ce4d2880ec9d8dab96573fd37fb08720b2c5`. Reviewed all workflow upload declarations and runtime stdout/report paths; no runtime artifacts were available to inspect. This is a source-level inventory, not proof that runtime payloads are clean. Forward-only redaction does not erase history.

| Surface | Producer / workflow | What must be checked before public reuse |
|---|---|---|
| Native results.json, identity/membership files, bootstrap stdout/stderr/process | adminit-synthetic-containment; AdminitSynthetic.cs, HostedMediumLauncher.cs | Token SID, ACL owner/writer SIDs, errors and absolute paths; all nested JSON/string fields; five cases plus distinct forced negative proof |
| Package and build/source identity, evidence-sha256.json | adminit build/package upload | Exact two-file package, source head/tree, compiler/identity claims; digest manifest is integrity metadata, not privacy review |
| Hosted containment native stdout, stderr and directory | q01-hosted-windows-synthetic | Process identities, paths and error strings; no physical acceptance from hosted evidence |
| Q01 JSONL/JUnit/receipts/report/manifest and child stderr | q01-reliability | Arbitrary error payloads, path/account topology, encoded content; exact scenario statuses, cancellation and missing cases |
| QA TAP/JUnit/results/manifest and diagnostic directory | qa-evidence-portability; qa-q01-diagnostic | Test failure source snippets and stacks, paths, XML escaped strings, nested JSON and encoded payloads |
| Browser test-results, traces and screenshots | browser | DOM/storage/requests/test errors and screenshots; do not assume test-results contains only JSON |
| Release provenance JSON | Validate, PDF, Browser, PostgreSQL, Windows | Exact source/repository/run/attempt/context and dependency identity; metadata remains producer-reported, not independent attestation |
| All Actions console logs | All workflows, including no-upload proof/AI/security jobs | Exception/stack output and test diagnostics also publish without an artifact; green/no artifact is not a privacy assertion |
| Local isolation collector stdout | collect-isolation.ps1 (not a workflow upload) | Machine/SID fields and source UNKNOWN: PRIVATE, do not paste raw observations into Git/issues |

`evidence-publication-policy.mjs` checks a bounded CURRENT tracked-document surface only. It does not scan the above streams, ZIP members, images, binaries or Git history. Existing runtime producers intentionally retain raw diagnostic evidence; do not label it public-safe based on this checker. Keep originals immutable; review private copies, then publish only separately hashed allowlisted projections. No raw runtime payload from ADMINIT has been collected or published in this follow-up.

## Artifact acceptance after jobs complete

Use authorized read-only transport. Bind workflow run ID/attempt, exact producing job and source event (PR synthetic merge differs from push head). Reject cancelled, skipped, missing or duplicated required contexts. Record API artifact ID/name/size/digest and downloaded ZIP SHA256; inspect complete ZIP entry inventory before extraction into a new audit directory. Reject duplicate/case-alias/traversal/absolute/link entries and expansion bombs. Verify each retained member against its manifest, package external digest and committed source/tree independently. A producer's digest cannot authenticate its own origin; correlate GitHub run/job evidence. Do not execute any ZIP member. No fallback to stale successful runs or unauthenticated artifacts.

Current exact-PR50 run set is still QUEUED, attempt1; artifact contents, archive safety/digests and native results remain NOT_RUN/BLOCKED. Absence of evidence is not a clean bill of health. New forced-watchdog model and compilation tests provide no runtime artifact privacy certification.
