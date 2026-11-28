# Research bridge: source-only development candidate

`math_universe_research_engine.run_research_v1` is the sole Python research composition boundary. It takes immutable `history_causal.Row` records and the original requested window. It delegates revision selection, strict availability (`available_ms < as_of_ms`), missing-coordinate detection and continuous segments to `history_causal.align`. Its window is `(start_ms, end_ms]`; it never replaces requested boundaries with observed support boundaries.

Complete 4 or 32 feature support is passed into the existing synthetic geometry dispatcher, which reuses E hyperspherical operations and C checked arithmetic. Incomplete support never bridges gaps. I spectral eligibility remains a structural diagnostic. Geometry failure is reported as a typed reason. Every result has `status=ABSTAIN`, `qualified=false`, and `authority=NONE`: neither caller DTOs nor structural eligibility establish source authenticity or qualified predictive evidence. Parent JS composition owns M structural applicability.

## Canonical V accounting

The research engine uses `math_resource_budget.BudgetCounter` as its sole counter. E source and its existing tests are reused byte-for-byte from `650fc86f9040e86f87f2f18be0f34add8f699cb5` (the R18 E_LOGICAL_V1 implementation plus R20 adversarial regressions). Its aggregate `_budget_quote`, runner-only scoped metering, nested C charges and `GeometryResultLease` remain unchanged. The engine detaches a deep copy of `lease.result` into its already-reserved staging, then releases the established lease through its context manager. The engine counts that detached geometry in its retained JSON envelope. A bare public E call with a budget remains refused. Returned bridge DTO bytes remain charged as live custody until the owner disposes of them and releases the corresponding bytes. Failed bridge calls release retained live bytes because no result is handed off; failed counters remain failed and consumed operation/output credits are never refunded.

These are logical credits, not native allocation limits, instruction counts, runtime isolation, source qualification, or production authority. Before calling I, the engine preflights and reserves a conservative staging quote of 65536 + 4096 bytes per input row + 512 bytes per requested coordinate slot. It charges logical input reads (512 bytes per row plus 128 per roster identity) and staging writes even for incomplete windows. The quote covers input custody, alignment, asdict snapshots, serialization staging and the result envelope. On return it transfers staging custody to the measured JSON envelope and releases the surplus; on failure it releases all newly acquired live custody. Output capacity is enforced by the shared counter before each output charge. JSON result size is measured only after that reservation under the independent hard bound of 256 states and 32 coordinates. It does not establish a native peak-memory ceiling. C nested scalar output credits remain charged in addition to the final DTO serialization.

## Replay

From repository root, with Python on PATH:

```powershell
$env:PYTHONPATH='python'
python -m unittest discover -s tests -p test_math_universe_research_engine.py
python -m unittest discover -s tests -p test_math_universe_research_kernel.py
python -m unittest discover -s tests -p test_history_spherical.py
python -m unittest discover -s tests -p test_history_causal.py
python -m unittest discover -s tests -p test_math_resource_budget.py
```
