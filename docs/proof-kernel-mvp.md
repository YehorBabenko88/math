# Experimental proof kernel MVP (GPT-1)

Base commit: `6c969ab049206c4f7f8c7348ff2148a352abd5b2`.

This module is **not** a general theorem prover, a Lean replacement, or production verification. It supports only propositional atoms, implication, assumptions, implication introduction and elimination. It has no axioms, quantifiers, equality, arithmetic semantics, definitional equality, proof persistence, or external certificate verification.

## Trust boundary
Untrusted AI/OCR/adapter output may propose `goal` and `proof`. The checker validates the complete goal and derives a conclusion using only three inference rules. Unknown fields and rules, unsupported types, cycles, invalid assumptions, and excessive complexity fail closed. A passing result has `formalStatus=CHECKED_IN_EXPERIMENTAL_KERNEL` and must **never** be mapped to project-wide `VERIFIED`.

The caller must independently bind the target statement to an approved source and check source identity; an AI choosing both goal and proof proves nothing about a requested theorem. Do not run arbitrary source code from books. Keep numeric `reproduced` distinct from mathematical verification.

## Future acceptance gates
- Independent Lean 4 replay against pinned toolchain and approved axioms.
- Typed mathematical AST and exact-goal hashes.
- Content-addressed provenance for source, theorem, dependencies and certificate.
- Resource-isolated proof checking and negative mutation/fuzz testing.
- Explicit human authorization before any production status promotion.

Run isolated tests: `node --test tests/proof-kernel.test.mjs`.

Q01 SQLite first-open remains separately unresolved. No production or book gate is opened by this MVP.
