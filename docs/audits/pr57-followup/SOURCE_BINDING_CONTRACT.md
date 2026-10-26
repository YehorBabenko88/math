# Corrected synthetic-merge source binding

Review date2026-10-26. PR58 source `eab8b8c88b1913ee19c7aa8c8456f04bf7ce2a5a` was independently checked, not accepted on its prose alone. Its assertion that REST run.head_sha is necessarily the synthetic merge is contradicted by the observed PR57 API shape. This was a fail-closed interoperability regression, not a demonstrated original PR57 authentication bypass.

Immutable objects captured in [source fixture](immutable-source-shapes.json):

- PR head H: `d18a95d2a0936c35d1c0d74febeb4b05d25f4366`.
- Base B: `920fd4977192bdd29606cb58d193fc7998a1c862`.
- Observed merge M: `b0a37f40b66f5733e5dd13b1203889867dabdf1b`.
- M tree: `2f598f6ead0707bbcc626b9800876514bc9b645b`; M parents exactly[B,H].
- Run40211216019 RESThead_sha=H, its four job head_sha values=H, associated PR metadata head=H/base=B.

The PR merge reference is mutable. We record the SHA observed from the PR API, fetch its commit/tree by immutable SHA and test that object. We do NOT claim that this currently observed M is the historical run's actual checkout or OIDC sha; no live bearer token was requested or inspected.

GitHub [event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request) separately defines GITHUB_SHA for pull_request as the merge-branch commit. It must not be conflated with observed REST run/job head_sha. Future receiver challenges must pin the actual signed source SHA and verify its immutable graph, never silently replace it with a current mutable PR merge ref.

## Accepted contract

For sourceRelation=pr-merge:

- JWT sha = challenge.sourceHead = fetched source commit M; tree = externally pinned sourceTree.
- REST run.head_sha and job.head_sha = challenge.runHead = sole associated PR head H.
- M != H, exactly two ordered parents[B,H], PR base=B, and externally pinned baseHead=B.
- Missing/ambiguous PR association, reversed/unrelated parents, wrong source/tree/RESThead/base all fail closed. No fallback to direct mode.
- All prior RS256 signature/JWKS, subject/repository/owner/workflow SHA/event, nonce/time/run/attempt/job/check-run inventory checks still run before the relational helper. Nonce/JTI journal, encryption and signature code unchanged.

For direct mode, supported non-PR event and sourceHead=runHead are required with baseHead=null. Unsupported evidence shapes are blocked rather than inferred.

`verifySourceBinding` is an exported data/graph check only. It returns no authentication, permission or PASS status. Receiver admission still calls full `verifyWorkload`; completed API samples cannot bypass its in-progress job/run and token gates. Tests against source objects establish graph compatibility, not live GitHub OIDC interoperability, native qualification or confidential operational acceptance.

PR58 negative substitutions and PR59 historical inventory QA are retained/adapted to these distinct identities. The original PR58 review is preserved with a forward correction, not silently rewritten as accepted evidence. Source PRs themselves are unchanged.
