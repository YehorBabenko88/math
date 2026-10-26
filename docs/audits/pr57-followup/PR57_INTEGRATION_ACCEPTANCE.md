# PR57 integration follow-up acceptance

Client review date2026-10-26. Base PR57 HEAD `d18a95d2a0936c35d1c0d74febeb4b05d25f4366`, tree `2f598f6ead0707bbcc626b9800876514bc9b645b`. New branch `integration/pr57-source-binding-qa`. Tested implementation `ec6c5e351f82c60dfe9b946455f5dddff0245c85`, tree `8110c1552f3649043df7334edbcd80f61c67da54`. Final delivery commit adds only this report/hash metadata; its exact HEAD/tree are supplied externally by GitHub/PR metadata and delivery response.

## Source PR review and integration

| PR | Current verified HEAD | Tree | Integration |
|---|---|---|---|
|58|`eab8b8c88b1913ee19c7aa8c8456f04bf7ce2a5a`|`e78dba0edfe57f005c68b6b9c8bf508d38ce4f7a`|Preserved-history merge8cec0e4, then corrected unsupported REST-head equality; negative cases retained/adapted|
|59|`6453f28647b1f510d439025c984cf72f9cc83d6e`|`a92b5a2b5ba15d418e4d7d47f3ea496afe578f95`|Preserved-history merge3822f46; five historical QA tests and report retained|

Source HEAD/tree refreshed through GitHub and Git objects; source branches/PRs unchanged. No textual merge conflicts. Integration was reviewed beyond CI/prose; PR58's asserted premise was not accepted as fact.

## Findings and RED/GREEN

**P2 — fail-closed interoperability regression in PR58.** The proposed line requires sourceHead=REST runHead=merge SHA. Exact source imported, coupled receiver test fails RED. Real run40211216019 and all four jobs instead report RESThead H=`d18a95d2...`; observed source merge M=`b0a37f40b66f5733e5dd13b1203889867dabdf1b` has tree `2f598f6ead0707bbcc626b9800876514bc9b645b` and ordered parents[B=`920fd497...`,H]. The original PR57 relation was not shown to be an authentication vulnerability. New strict relation keeps distinct M/H, pins tree and both ordered parents, requires exactly one PR association and refuses missing/ambiguous evidence. Source-only helper grants no authentication/permission.

Immutable API source objects were fetched by exact SHA and independently matched to a Git object fetched with fetch.fsckObjects/transfer.fsckObjects enabled and read using --no-replace-objects. [Recorded source fixture](immutable-source-shapes.json). The observed current merge ref was resolved once to an immutable object; this does NOT establish the historical job's checkout or actual signed OIDC sha. No real bearer token was requested or inspected. [Contract](SOURCE_BINDING_CONTRACT.md) distinguishes REST head and documented PR GITHUB_SHA semantics; source verification never falls back to a mutable current merge ref.

All prior signature/JWKS/issuer/subject/owner/repository/workflow SHA/event/hosted runner/time/nonce/run/attempt/job/check-run inventory checks remain before the graph check. Encryption, signing, bundle and replay journal implementations unchanged. Receiver still calls full verifyWorkload; completed API samples cannot satisfy its live in-progress/token gates merely by passing a source graph helper.

**P2 — independent review follow-ups.** Fixture-only edits initially did not schedule receiver CI. Added source/metadata path triggers and explicit source/current-QA tests; RED then GREEN. Retained PR58 report initially asserted the disproven premise without qualification; added dated forward correction and a regression verifying it (RED/GREEN, including CRLF insertion). Both findings resolved in final static review; no concrete authentication bypass identified. No test or runtime execution was performed by that reviewer.

Preserved PR58 negatives for wrong parent/head/tree, signed PR-head substitution, missing/duplicate check-run/attempt job, stale source and ambiguous PR association. Added direct-mode separation and graph-check-no-admission tests. [Local SHA256 evidence](local-evidence-sha256.json) retains failing and passing states privately rather than publishing raw local stacks.

## Current CI — not historical queue assumptions

[Current bounded inventory](current-ci-snapshot.json), [table](current-ci-summary.md): captured2026-10-26 09:02:20–09:03:54 UTC. Three exact source heads plus three legacy samples, not every repository run.140 canonical GETs,131 paginated collections, zero canonical API/pagination errors; one initial wrong-owner discovery404 is separately disclosed.

| Source | Runs success/failure | Jobs success/failure | Run-scoped artifacts |
|---|---:|---:|---:|
|PR57 exact HEAD|26/5|108/21|70|
|PR58 exact HEAD|12/3|48/14|34|
|PR59 exact HEAD|13/2|52/10|34|

All observed runs/jobs are now completed. This is not a claim that all conclusions are success. Attempts are recorded per run and jobs obtained from explicit current-attempt endpoints. Artifact IDs/digests/size/expiry are recorded separately; API inventory is run-scoped, so artifact attemptBinding remains NOT_PROVEN_BY_RUN_ARTIFACT_API. Names do not prove attempt identity. No logs/artifact bytes downloaded here; no ZIP integrity/privacy or native-acceptance PASS inferred from metadata.

Receiver-contract runs: PR57 `40211216019` success4/4, PR58 `40212955947` failure4/4, PR59 `40213286536` success4/4, all attempt1/zero artifacts. Local RED supplies code evidence; no claim that uninspected CI logs prove a particular failure cause. Other native/PostgreSQL failures remain outside this receiver-only fix; complete-project GO is not established.

Legacy samples40183964438,40184384450,40184389853 are now completed/success, each attempt1 with14 jobs and12 artifacts. Prior queued observations are historical, not a current state. The old370 cancellation proposals remain a frozen historical dataset only; no active cancellation list is produced, inferred or approved. No cancellations, reruns, dispatches or artifact removals performed.

## Permitted verification matrix

| Check | Result |
|---|---|
|Node22.23.3, ten receiver/source/QA files|101 PASS /0 FAIL /0 SKIP|
|Node24.20.0, same explicit files|101 PASS /0 FAIL /0 SKIP|
|Immutable Git/API source graph|MATCH; source graph only, not actual run checkout attestation|
|Tracked evidence publication policy|PASS within its bounded document scope|
|Historical inventory QA|PASS as historical dataset checks, no live authority|
|Original source CI|Mixed completed conclusions above; not all-green|
|New candidate hosted CI|Inspect exact final SHA separately; no historical status reused|
|Live OIDC/token/custody/confidential delivery|NOT_RUN / UNQUALIFIED|
|ADMINIT/native/PowerShell/bootstrap/physical Q01/PG|NOT_RUN this task|

No full npm test and no PowerShell/C#/native fixture launch. Local Node tests use only synthetic in-memory keys and isolated receiver storage; no Book/Q01 laboratory test ran. Prior PR57 unauthorized full-suite deviation and its9 failures remain historical/nonqualifying, not rerun or silently converted to PASS. Protected owner/PowerShell/Execute source, production databases, scientific verification and Book gates unchanged.

## Decision

GO for independent code review only. Operational confidential acceptance, actual GitHub OIDC compatibility and physical/native qualification remain BLOCKED. Existing source/full-CI failures must not be hidden by the focused101/101 result. Future work: independently accept this source contract and receiver custody/collector/transport, then qualify fresh exact-source evidence. No automation enables Execute, G1, native acceptance or mathematical VERIFIED.

Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book gate CLOSED. No main merge, source PR update, system setting change, deployment or production operation.
