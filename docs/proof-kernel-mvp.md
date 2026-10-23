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

## Closed theorem versus conditional derivation

The checker now returns `openAssumptions` and `isClosedTheorem`. A successful
derivation with nonempty assumptions is **conditional** and must not be
advertised as an unconditional theorem. Even `isClosedTheorem=true` means
only derivability in the experimental implication calculus, not a project-wide
verified mathematical claim.

Input normalization creates a data-only copy and rejects accessor properties,
symbols, special prototype-control keys, cycles, sparse arrays, and excessive
depth. **Important JavaScript limitation:** a hostile in-process Proxy can run
user code through language-level reflective traps before normalization rejects
it. This checker therefore must not accept arbitrary attacker-controlled live
JavaScript objects as a sandbox boundary. Use parsed JSON from an isolated
untrusted-data boundary, enforce byte limits before parsing, and never execute
untrusted code in the verifier process.

## Exact-HEAD acceptance

The isolated GitHub Actions workflow tests Node.js 22 and 24. A queued,
skipped, cancelled, or missing workflow is not PASS. Record the exact HEAD,
workflow run IDs, JUnit or test output, and SHA256 of evidence before an
independent reviewer considers this experimental gate. The presence of
successful synthetic tests does not establish physical acceptance or close Q01.

## Independent semantic smoke test

The regression suite includes an independently written Boolean evaluator for
atoms and implication. It checks the identity introduction schema and
assumption-based implication elimination across a small formula corpus and all
four valuations of two atoms. This is a bounded **soundness smoke test**, not
an exhaustive metatheoretic soundness proof and not Lean replay. The oracle
does not import or call the proof kernel's structural equality implementation.

## Canonical JSON-text contract

`verifyImplicationProofJson` accepts at most 256 KiB of UTF-8 JSON text and
requires `JSON.stringify(JSON.parse(text)) === text`. This rejects duplicate
object keys because parsing collapses them, as well as noncanonical whitespace
and alternative number spellings. Producers should serialize their plain-data
certificate once with JavaScript `JSON.stringify`; pretty-printed JSON is
intentionally rejected. This is a JavaScript-specific canonical transport
profile, **not RFC 8785 JCS**. It is not a signature scheme, does not establish
provenance, and does not authorize a VERIFIED status.
