# Independent historical CI failure investigation — PR69–PR73

Read-only source/log investigation. No full stress, production, physical Windows or reruns.

## Exact PR heads

- PR69 `a46510cb42a9dc98230042c1fd2aaaff3a39410d`
- PR70 `3dc9ddc3e382aa18aadfcf8fe6d51ffa5b3ea9af`
- PR71 `151c77fa2e6ec0b20210bd8b6d1101225120eea2`
- PR72 `61f46d7b09642945637eaf797b0795b62fddc9b5`
- PR73 `629edc7c328a31e4568fcccda51dc032e621ecab`

## Historical RED evidence

| PR/run/job | Step | Observed | Classification |
|---|---|---|---|
| 69 / [40309240276](https://github.com/YehorBabenko88/math/actions/runs/40309240276) / 121525965401 | Authenticate immutable collector inputs before requesting a bearer | `PINNED_SYNTHETIC_QUALIFICATION_BLOCKED:E_OIDC_TIME`; exit 1, after ~5 seconds | Strict OIDC/collector time bound or timed network request. Fail closed. Underlying clock-vs-network cause **not independently proven** from redacted log. Not PASS. |
| 70 / [40311169270](https://github.com/YehorBabenko88/math/actions/runs/40311169270) / 121532425344 | Scoped pure receiver and collector contracts | `G0 parse only: powershell.exe`; `spawnSync powershell.exe ETIMEDOUT`, SIGTERM, 15s subprocess deadline; Node step exit 1; 205 PASS/1 FAIL | Timeout/resource contention or Windows PowerShell startup hang; not evidence of G0 parser semantic defect |
| 71 / [40314581409](https://github.com/YehorBabenko88/math/actions/runs/40314581409) / 121543857434 | Scoped pure receiver and collector contracts | `G0 parse only: powershell.exe` ETIMEDOUT 15s; `pure G0 token/ACL fixtures: powershell.exe` reports `G0_PURE_FIXTURES_BLOCKED` after 15s; 211 PASS/2 FAIL; step exit 1 | Two Windows PowerShell 5.1 child-process timeout failures. Second test masks exact subprocess error in catch; cause cannot be classified as token/ACL source defect. |

## Later runs do not rewrite history

- PR72 [40316741877](https://github.com/YehorBabenko88/math/actions/runs/40316741877): 4/4 hosted receiver jobs success.
- PR73 [40319492499](https://github.com/YehorBabenko88/math/actions/runs/40319492499): 4/4 hosted receiver jobs success.
- These are different revisions, with different test inventory and workflow scoping. No direct RED-to-GREEN proof for the old PowerShell subprocess under identical conditions, and no PR69 collector OIDC issuer qualification is implied.
- PR72 Linux Node22 job 121551125985 reports 209 PASS, 0 FAIL, 10 SKIP; PR73 Windows Node22 job 121560472817 reports 226 PASS, 0 FAIL, 0 SKIP. Neither result establishes native or physical G1.

## Minimal targeted regression recommendation

Do not edit the Token API implementation. Keep `powershell.exe` and `pwsh.exe` separate in hosted reporting. For a dedicated Windows-only diagnostic fixture, launch a fixed `-NoProfile -NonInteractive` literal parse-only command in a bounded child process; capture exit code, signal, `ETIMEDOUT` classification, elapsed duration and whether process startup or parsing began, without raw token/ACL data. Preserve timeout as FAIL/BLOCKED, not SKIP/PASS. Do not extend 15s or add retries without evidence of the specific cause. Test the diagnostic independently on Windows Node22 and24 before proposing any behavior change.

For collector `E_OIDC_TIME`, add only a pure, deterministic boundary test around a mocked fixed clock and simulated delayed response; no bearer or live OIDC token, and no loosening of timestamp validation. A real issuer failure requires separate pinned run/attempt/job and clock/network diagnostics.

## Decision

P1: PR69 collector hosted qualification FAILED; root cause within E_OIDC_TIME not fully attributable.
P1: PR70/71 Windows PowerShell 5.1 subprocess timeouts are real CI failures, likely environment/resource scheduling or process-startup nondeterminism; not proven source semantics.
P2: Missing explicit subprocess error metadata in PR71 fixture catch reduces diagnostic resolution.
P0 gate: Q01 OPEN, G1 BLOCKED, Book gate CLOSED, production NO-GO.

No Token API source edits. No merge, deployment, stress, cancellation or physical tests. This report is a source/log classification, not a qualification receipt.
