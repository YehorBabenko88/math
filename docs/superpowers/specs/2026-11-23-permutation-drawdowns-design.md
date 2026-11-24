# Permutation drawdowns design

User-authorized implementation from public Math001. Add permutation_drawdowns(values, *, runs=1000, seed=0) returning an immutable tuple of float drawdowns. Admit only nonempty exact list/tuple of <=4096 plain lossless finite int/float values, exact runs 1..1000, seed 0..2**31-1, <=1000000 value visits. Capture the complete sequence before the first numeric admission or RNG construction. A private Random instance shuffles a fresh original-order list for each run, exactly matching the pinned legacy resampling.py algorithm.

Approaches: calling the full PnL summary introduces unrelated profit-factor overflow limits; duplicating its ordered equity loop would create competing Math kernels. Use one extracted private equity/peak/drawdown/streak helper shared by PnL and permutation analysis. Preserve operation order, finite result checks, error messages and old PnL semantics. Derived nonfinite results abort the whole return. No global RNG mutation or market, stationarity, risk-of-ruin, accounting or execution authority inference.

Version source custody as v7; retain v4/e3, v5/420, v6/001 actual raw fixtures and meanings. Add one mandatory SDK source/wheel group, preserve eight existing groups and numerical ABI. No dependencies, services, local native operations or publication.
