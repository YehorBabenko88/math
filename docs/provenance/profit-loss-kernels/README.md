# Generic profit/loss numerical kernels

Math owns signed sample totals, gross positive/negative totals, profit-factor tags, ordered drawdown and loss streak arithmetic. These are generic caller-declared values with caller-declared units, not trade/fill objects or source evidence. No simulation or strategy selection is introduced.

DECIMAL_TO_BINARY64_V1 explicitly projects finite exact Decimal records to nearest binary64 for descriptive statistics only. It permits rounding, refuses nonzero underflow/nonfinite overflow, and leaves caller context flags/traps unchanged. Exact PaperEngine Decimal balances and accounting are not altered. No financial precision recovery is claimed. ORDERED_BINARY64_V1 uses explicit sequential additions on both Python versions.

Original statistics fields for gross fees, MAE/MFE, R multiples and holding durations are not transferred by these two helpers. Existing legacy statistics/evaluator callers remain until their complete consumer flow moves. No legacy role deduction from516. The verified old source archive is reused by path; it is evidence, not an import.
