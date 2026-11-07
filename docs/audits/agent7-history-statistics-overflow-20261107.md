# Finite bootstrap evidence

Base: 917d99672e37db59835a8ab23b03c99826b12d78. Scope: numerical component only.

Finite paired differences could overflow to infinity and falsely report directional support; summation could overflow before division. The regression baseline has 7 failures and 3 passes. The fix rejects nonfinite differences and uses math.fsum with statistics.mean fallback on OverflowError, preserving subnormal and cancellation behavior. Gross/net/cost/funding interpretation, RNG and inputs are unchanged.

Local Python 3.12.10: ten numerical tests pass without skips. Existing history suite with pinned Grid7a83 dependency: 25 pass without skips. Initial missing-dependency failure is retained in outputs. Fresh isolated workflow block on clean committed source: 10 PASS, zero skips. Four isolated negative clones (cache, shadow, tracked-byte change, replacement ref) each refuse before project test execution, exit 1, zero tests/skips. An initial working-tree guard refusal detected four pre-existing ignored pyc files; retained as evidence, no bypass. Independent static reviewer found no concrete defect; hosted execution remains separate. Hosted Windows/Ubuntu evidence pending. No native, physical, authority, distributed, scientific-validity or profitability acceptance is claimed.

Rollback: revert this isolated four-path change; no database or ledger migrations. Existing proof manifests and historical evidence remain unchanged.
