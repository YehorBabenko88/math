# Roots convergence API — bounded numerical audit

Exact base PR87 `a7af248da5e96222186fe550cea9d5a8386eb0fb`. Original PRs remain unchanged. See docs/roots-diagnostics.md for the public contract and numerical limitations.

Independent reproduction: legacy roots([1,0,0,-1],{maxIterations:1}) returns three finite approximations with max absolute residual2.1380937326944993. This is expected early-iteration behavior, but the old API has no convergence metadata. It is not evidence of successful convergence. The new opt-in function preserves those candidates and reports false/MAX_ITERATIONS/iterations1. No production caller is migrated and the original roots implementation is unchanged.

RED: new diagnostics test could not import the missing export. The legacy finite-but-unconverged case was independently reproduced before implementation. GREEN: new tests check insufficient/zero iteration budgets, complex roots, double/triple roots, clustered roots, scaling, normalization overflow/underflow, arithmetic failure with preserved finite candidates, stagnation, zero residual tolerance, analytic residual failure and a cancellation-sensitive Wilkinson degree-ten polynomial. Input immutability and original residual recomputation are checked. Success requires finite arithmetic, a small step and both original/monic residual thresholds, not finiteness or budget exhaustion alone.

Observed bounded Node probes (not universal guarantees): double root [1,-2,1] satisfies the criteria in32 sweeps with residual≈6.26e-19; triple root [1,-3,3,-1] reaches500 sweeps without step convergence despite residual≈3.15e-15; Wilkinson degree10 reaches500 sweeps with residual≈1.36e-5. These outcomes demonstrate why step, residual and conditioning must be distinguished. No numeric claim is promoted to a proof or scientific VERIFIED status.

Node22.23.3 and Node24.20.0 each run17 tests:17 PASS,0 FAIL,0 SKIP. Inventory: roots-diagnostics.test.mjs, legacy math.test.mjs, and two branch-scope/caller test files. Full/npm/native/PowerShell/C#/PostgreSQL/Q01/G1/production suites are not run. Exact-head hosted Windows/Linux Node22/24 scoped outcomes and private log hashes must be verified after push; CI here is numerical/contract testing only, not physical acceptance.

Static second review found no blocking numerical/compatibility issue. Suggested arithmetic/stagnation/strict-residual regressions were added and executed independently. Source-preservation receipts compare the legacy roots body and existing helpers to the exact base. git diff --check and tracked evidence publication policy are required.

Remaining risks: native floating-point Horner evaluation is not a rigorous residual bound; coefficient scaling affects the absolute metric; repeated/clustered roots weaken the link between residual and forward error; high-degree/extreme inputs may fail conservatively. The method provides no backward-error certificate, multiplicity/completeness proof or mathematical theorem status.

ADMINIT SECURITY HOLD and Norton settings are untouched. No physical Token API, C# compiler, PowerShell smoke, database, G1, deployment or merge. Q01 OPEN; G1 BLOCKED; Production NO-GO; Book gate CLOSED.
