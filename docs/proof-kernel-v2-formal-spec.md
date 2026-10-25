# Proof Kernel V2 — independent semantic contract (experimental)

## Scope and trust
This document specifies the restricted, intuitionistic implication-only propositional calculus implemented by `src/proof-kernel.mjs`. The implementation, its input normalization, and this specification are not independently certified. Neither an OCR/LLM proposal, an accepted local proof, nor a signed kernel attestation is a project-wide `VERIFIED` assertion. Production publication remains disabled, Q01 OPEN.

## Syntax and contexts
Formulas are inductively defined by `A ::= Atom(name) | Imp(A,A)`. Atomic names match ASCII `^[A-Za-z][A-Za-z0-9_]{0,63}$`. Structural equality is equality of the full ordered abstract syntax tree, not textual substitution or semantic equivalence. A context `Γ=[A0,...,An-1]` is an **ordered** list. An assumption index is zero-based from the **outermost** element; introduction appends a new assumption at the end, so index `n` refers to it and original indices do not shift. Duplicate elements remain distinct positions. Proof nodes are exclusively `Assumption(i)`, `Intro(A,p)`, `Elim(f,a)`.

## Rules
- ASSUME: if `0 <= i < |Γ|`, then `Γ ⊢ Assumption(i) : Γ[i]`.
- INTRO: if `Γ ++ [A] ⊢ p : B`, then `Γ ⊢ Intro(A,p) : A → B`.
- ELIM: if `Γ ⊢ f : A → B` and `Γ ⊢ a : A`, then `Γ ⊢ Elim(f,a) : B`.
- No additional rules, weakening by hidden premises, or implicit axioms are licensed.

## Soundness lemma and proof
For any Boolean valuation `v`, write `v ⊨ Γ` iff every formula in Γ evaluates to true, with `eval(A→B,v)=(!eval(A,v) || eval(B,v))`. Claim: if `Γ ⊢ p : A`, then for every `v ⊨ Γ`, `eval(A,v)=true`.

Induct on the finite derivation tree. ASSUME selects an element of Γ, true by the context hypothesis. INTRO: for a valuation satisfying Γ, either A is false (so A→B true), or A is true, in which case the same valuation satisfies Γ++[A] and by induction B is true. ELIM: by induction both A→B and A are true, hence B is true by implication truth semantics. Thus the abstract rules preserve semantic consequence. A context-free derivation `[] ⊢ A` yields a Boolean tautology. The converse (completeness), the JavaScript implementation's refinement to this semantics, and authenticity of supplied theorem/source are *not* established by this argument.

## Checker input and failure
Requests carry exactly `goal,proof` with optional `assumptions`. Unrecognized fields, invalid syntax, ill-scoped indices, mismatched implication antecedents, and derived goal different from the requested goal reject. A successful derivation under a nonempty top-level context is *not* a closed theorem, even if the particular proof never uses all assumptions. The JSON parser accepts a JavaScript JSON.stringify round-trip transport profile (not RFC8785); duplicate keys and noncanonical whitespace must reject. Inputs have bounded depth, context, nodes, and textual bytes; these are resource limits, not a process memory/CPU sandbox.

## Knowledge Graph integration, no promotion
The trusted caller supplies (rather than derives from OCR/LLM) a theorem revision, an exact target AST or digest, proof revision, context digest, source provenance digest, and pinned kernel implementation identity. Candidate ingestion only emits `CANDIDATE`. A formalization binds a versioned AST and dependencies without changing trust. A proof request binds exact hashes of all these objects, plus a fresh nonce. The kernel checks a *specific expected goal* and optionally its closedness. A signed result only authenticates the report against the trusted signer policy; replay must be rejected by an atomic persisted ledger. A verification assessment remains `AUTHENTICATED_RESULT_ONLY`/`CHECKED_IN_EXPERIMENTAL_KERNEL`, never `VERIFIED`. Independent implementation review, pinned toolchain, explicit axioms/trust roots, approved provenance, and authorized publication remain separate gates.

## Forward-compatible interface sketch (not implemented publication API)
```json
{
  "schema_version": "proof-request.v2-draft",
  "theorem_revision": "sha256:<64 lowercase hex>",
  "theorem_ast_hash": "sha256:<64 lowercase hex>",
  "proof_revision": "sha256:<64 lowercase hex>",
  "context_hash": "sha256:<64 lowercase hex>",
  "source_hash": "sha256:<64 lowercase hex>",
  "kernel_build_hash": "sha256:<64 lowercase hex>",
  "nonce": "<random single-use identifier>",
  "require_closed": true,
  "allowed_axioms": []
}
```
Any implementation must validate exact fields, canonical serialization and digest domain separation, and link raw proof bytes to the proof hash. The sketch is *not* a production contract or a supported new inference rule.

## V2 gates
1. Machine-check this grammar and inductive lemma in an independent proof assistant; pin version and dependency hashes.
2. Define typed term AST, schema/version/domain-separated hashes and deterministic replay; reject goal substitution.
3. Track dependencies, explicit axiom inventory, trust policy and weakened/open contextual assumptions.
4. Add first-order quantifiers/equality only after formal capture-avoiding substitution and a separately proved preservation argument.
5. Allow Lean replay only with an explicit admissible axiom list and no automatic publication upgrade.
