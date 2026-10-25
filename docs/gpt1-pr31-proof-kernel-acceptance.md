# GPT-1 independent proof-kernel acceptance — PR #31

Candidate commit: `cb168925b5aeec0c957137dd94ab72c64f0bd333`
Candidate tree: `10cfd29f5d2c75e841d88dd70bef8773dada8287`

## Scope and findings
Reviewed `src/proof-kernel.mjs`, `src/knowledge/kernel-result-boundary.mjs`,
`src/knowledge/kernel-authenticator.mjs`, and their relevant tests. The
implication calculus admits assumption, implication introduction, and
implication elimination only. Top-level assumptions are explicitly counted;
closed-theorem APIs reject them. Exact expected-goal binding is checked
before returning a closed proof result. The 256 KiB JSON-text limit is
checked before parsing in both JSON entrypoints. No successful API returns
project-wide `VERIFIED`. Authenticated knowledge results are labelled
`AUTHENTICATED_RESULT_ONLY`, not mathematical verification.

P1: live JavaScript Proxy objects were not explicitly rejected before
reflective normalization, so traps could run in-process. This audit branch
adds Node `types.isProxy` rejection before reflection and regression tests
asserting no traps execute. This does not make an in-process checker a
general sandbox for arbitrary malicious code.

The independent seeded regression suite checks 180 identity proofs, 180
conditional modus-ponens derivations, and 180 goal-substitution mutations,
plus malformed inference rules, JSON limits, getter/cycle/prototype attacks,
and closed-theorem/VERIFIED nonpromotion. These are bounded properties, not
a metatheoretic proof of soundness.

## Evidence and acceptance
Original candidate isolated proof workflow:
https://github.com/YehorBabenko88/math/actions/runs/40183990756
Status observed: SUCCESS.

The audit branch adds its own isolated Node 22/24 CI coverage.
Until an exact audit-HEAD run finishes, these new tests are NOT_RUN/UNVERIFIED,
not PASS. No local run is claimed: direct GitHub clone was blocked by DNS
resolution in the available execution environment.

Q01 OPEN. Production NO-GO. Do not merge, deploy, activate containment, or
change the pinned integration candidate. Further acceptance requires exact
HEAD/tree CI evidence, negative test review, and independently pinned
provenance; Lean replay is not established by this limited calculus.

## Follow-up adversarial coverage (2026-10-25)

Additional deterministic tests cover 120 composition theorems of the form
`(A -> B) -> ((B -> C) -> (A -> C))` and 100 implication-elimination
premise-substitution attacks. Their independent Boolean oracle enumerates
all eight valuations of P/Q/R. This is a bounded semantic cross-check only.

CI for the new audit commits has not been independently confirmed at the time
of publication; no passing status is inferred from queued or absent runs.
Container clone was attempted using `git ls-remote` and failed DNS lookup
for github.com. Consequently these new cases are **NOT_RUN locally**.
The source candidate remains pinned, and no merge or physical operation
is authorized. Q01 remains OPEN, production NO-GO.

## Negative-test quality refinement

The 100 seeded premise-substitution cases now unconditionally assert rejection:
the replacement premise is `A -> A`, which is structurally distinct from
`A` for every finite formula in this grammar. A separate reversed-direction
test checks that `B -> A` plus `A` does not establish `B` unless the
antecedent accidentally coincides with the supplied argument. Skipped
cases are not counted as independent negative coverage. These changes are
tests only; no new inference rule or axiom was introduced.

## Cross-PR compatibility: #26 and #30

PR #26 HEAD `85608195536f613aca09b5298481bf6247319d4e` adds the
pre-parse proof-text byte guard to the expected-goal API. That guard is
already present in candidate PR #31 HEAD `cb168925b5aeec0c957137dd94ab72c64f0bd333`.
No duplicate implementation patch is required.

PR #30 HEAD `fa6c7af6d4075a06f6681413140d99228f63050d`
adds `tests/proof-kernel-independent.test.mjs`, a formal specification and
an isolated CI path. Its semantics use the same ordered-context rules as
this audit's independent suite. PR #30 is not assumed merged into #31;
its workflow and test file must be reconciled by Codex before integration,
not silently counted as present.

This audit adds explicit scope-index and unused-top-level-assumption
regressions. No inference rule was changed. A new audit-HEAD workflow
result must be read before claiming PASS. Local clone was blocked by
github.com DNS resolution, so local test execution remains NOT_RUN.
