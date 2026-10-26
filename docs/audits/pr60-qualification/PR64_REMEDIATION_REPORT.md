# PR64 hosted failure remediation

Date: 2026-10-26. Base/control PR64: 9094a68fe723e6618e6726f97d8a7df67a76d790, tree 6deee700d374a821cf09b4a4ed0eeb915f965e1f. Original PR remains unchanged.

## Original evidence and limits

Run 40307348709 / attempt 1 / job 121519619696 failed. Its single public ZIP artifact 12642078955 is 331 bytes, independently downloaded SHA-256 d1c0148f97eea94bd9dacb4bab507055e94e5f34021441ceb4596a012483b108 (matches API digest). It contains only qualification.json, status BLOCKED, phase STRICT_OIDC_OR_TRANSPORT. No claims diagnostics were present.

The artifact could only be published after the immutable loader fetched and hashed its twelve regular Git blobs, ran the child, loaded its pinned public schema and validated its fixed transcript. Thus a missing collector pin, denied loader API permission, missing OIDC request permission or bootstrap failure is inconsistent with the recorded downstream artifact. The original workflow pins fa9508b00d285c58a435b37a0a581f0f84b486b3 and grants only contents:read/id-token:write. Private original job log was retained locally, never republished.

## Confirmed defect and inference boundary

The original verifier requires exactly alg/typ/kid in its JOSE header. GitHub's official OIDC documentation includes x5t. A locally signed RS256 token with that documented shape fails before signature verification. RED reproduced; GREEN validates an optional canonical 20-byte x5t only when it exactly matches the selected official JWKS key. Key selection remains kid-based, RS256 signature is still mandatory and unknown headers (including jku/crit), bad thumbprints and substitutions fail closed.

Source: https://docs.github.com/en/actions/concepts/security/openid-connect

This proves a compatibility defect, not possession or reconstruction of the original ephemeral JWT. The original generic phase cannot uniquely distinguish it from a provider-fetch, decrypt or other pre-signature error. Exact original-token causality therefore remains bounded; the first corrected hosted run must supply fixed stage evidence. No raw token is requested outside the disposable hosted job.

## Diagnostic and security changes

Fixed closed-enum codes identify loader/API/blob/child, envelope/unseal, issuer header/JWKS/signature, policy/challenge/binding/time/platform/source, ZIP and journal stages. Error messages remain generic BLOCKED. Inner collector authorization codes survive wrapper catches. Public data contains no claim observations, token, key, SID, PID, private path or stack trace. Unknown codes or extra public fields fail schema validation.

No workload policy, nonce expiry, iat/nbf/exp constraints, source/run/attempt/job/check-run relation or crypto algorithm was relaxed. A real token may still be rejected by these strict constraints; such failure must remain BLOCKED rather than be relabeled PASS.

## Independent PR integration

|PR|Exact reviewed HEAD|Merge base with PR64|Disposition|
|---|---|---|---|
|61|1c0030763bd7eb2ce44fc87bc54d9a43ca8b23d8|b24d2d6ca264926c1a65a96f574057192bfeca03|Pure negative watchdog tests and report transferred; native/model execution NOT_RUN in this scope|
|62|b84a818f254fbf9a482406213bd56395aa4c5db0|same|Receipt authority-field defect reproduced RED; closed receipt schema GREEN. Same attack independently reproduced/fixed for synthetic receipt|
|63|ce0c586e9738312394e2fd58ab8c858fb7cc6fd3|same|Read-only historical hosted report retained; not current acceptance or cancellation authority|

Only reviewed file changes were transferred onto the isolated PR64-based branch; no source PR or branch was changed. No native harness or Execute guard changed.

## Test matrix and provenance

|Environment|PASS|FAIL|SKIP|
|---|---:|---:|---:|
|Local Node22.23.3, enumerated receiver/collector contracts|134|0|0|
|Local Node24.20.0, same 20 files|134|0|0|
|New hosted real issuer qualification|PENDING|—|—|
|Native/ADMINIT/Q01/full npm/PG|NOT_RUN|—|—|

RED/GREEN TAP SHA-256 references: PR64_REMEDIATION_EVIDENCE_HASHES.json. Raw TAP/logs remain outside Git. git diff --check and current tracked-document publication policy pass; that policy does not certify runtime logs or clear Git history.

New immutable collector snapshot: 4da26a3c83fb6adea4f83a9a58fb90c0cc4a3195. Caller pins this exact SHA; final branch HEAD is the commit containing this report, not a self-referential attestation. Only receiver and synthetic workflow jobs are enabled for this branch; unrelated jobs are explicitly skipped and are NOT acceptance success.

## Acceptance

GO only for one new synthetic hosted attempt justified by the reproduced JOSE defect and corrected diagnostics. No rerun/cancellation. After completion independently inspect exact run/attempt/job/source, one allowlisted artifact, ZIP digest/inventory/schema and all relevant logs. A signature observation is not workload authorization; success cannot be inferred from an upload on failure.

Operational confidential receiver/custody is still UNQUALIFIED. Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book gate CLOSED. No physical/native execution, production actions or merge.

### Workflow-format correction

The first remediation candidate 914df59c16b606dd4a8d4bf7ad7042a197328f85 was rejected before job execution: regenerated manifest lost YAML literal indentation. Run40309109748 has no collector jobs. This preparation defect was reproduced by a new literal-block regression (RED) and corrected (GREEN). It gives no OIDC authorization evidence. The next ordinary push is justified by this concrete fix, not a blind rerun. Prior candidate/evidence are retained.
