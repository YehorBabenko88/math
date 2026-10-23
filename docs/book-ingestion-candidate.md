# Knowledge candidate contract

`knowledge-candidate/v1` is an untrusted, page-bounded extraction DTO. Its full
structural contract is `book-ingestion-candidate.schema.json`. Runtime validation
also enforces relationships, aggregate budgets, provenance pins and dimensions;
JSON Schema alone does not establish those properties.

`validateCandidate(input, context={})` returns a detached, deeply frozen candidate.
`input` may be a plain JSON object or a JSON string of at most 256,000 characters.
`verifyCandidate(input, context={})` returns `{candidate,digest,report}`. Report has
`status:'valid'|'contradicted'`, `dimensionChecked:true`, `examples`,
`scope:'numeric-examples-only'`, and `requiresVisualReview`. Malformed candidates,
dimension errors, forged statuses, dangling references and mismatched pins throw.
Numerical mismatches or numerical domain errors return `contradicted`, with
per-example actual/expected/boolean passes and an error when arithmetic fails.

Context accepts `expectedSource` (compares `hash64hex`, `edition`, `version`,
`license`; additional trusted intake fields are ignored), `expectedLocator`
(exact full locator), `expectedExtractionVersion`, `expectedExtractionQuality`, `expectedTextHash`, and
`maxTextChars` (integer 0..2000, default 2000). Production ingestion must provide
all source, locator, extraction version, quality and text-hash pins from its trusted intake/extraction boundary; validating a candidate
against its own fields does not establish source authenticity. Source hash and
text hash are lowercase 64-character SHA256 hex. Version and edition are literal
pins, not interpreted latest-version selectors. PDF page is 1-based; printed page
is a nonempty string or null; region is normalized `[x,y,width,height]` or null,
with positive width/height contained in the unit page. Evidence must use the same
PDF and printed page and, if the candidate is region-bounded, fit inside that
region. The caller pins the page to the actual source page count.

`canonicalCandidate(input)` returns stable recursively sorted-key JSON and
`hashCandidate(input)` returns its SHA256 UTF-8 digest. Array order is significant;
object key order is not. Negative zero normalizes to zero. No Unicode
normalization, string trimming or source rewriting occurs. The digest identifies
the candidate content, not human approval or source authenticity.

Candidate text budgets sum concept labels/definitions, claim text, formula
assumptions and evidence notes. License/edition, locators and structural fields
have separate small bounds. Do not store long book excerpts in these fields.
The runtime caps total copied text at 64,000 characters, total data nodes at
20,000, generic nesting at 64, collection lengths, formula AST depth at 24 and
AST nodes at 128 per formula. Accessors, inherited prototypes, sparse arrays,
cycles, nonfinite values and unknown fields are rejected. Use JSON, never proxies
or application objects, as the untrusted intake boundary.

Formula inputs declare scalar SI units from the existing unit registry. Safe AST
allows `input`, `constant`, `add`, `subtract`, `multiply`, `divide`, and `sqrt`.
Unary square root uses `{op:'sqrt',value:AST}`; binary operators use `left/right`.
Square root requires even inferred SI exponents and a nonnegative numerical
operand. Units convert through SI; all formulas are dimension-checked before any
example executes. Each formula requires one or more independently supplied
examples; the verifier cannot establish their scientific independence. Expected
values use the output unit and tolerance compares
`abs(actual-expected) <= tolerance*max(1,abs(expected))`, tolerance 0..0.01.
No source expression, code string, dynamic import, eval or generated code runs.

IDs are unique within each entity type. Claim dependencies form a DAG; referenced
concepts/formulas/claims must exist. Claims always remain `untested`, even if all
supplied numeric examples pass. `valid` describes contract and example checks,
not a theorem or book's correctness. Formula-free conceptual candidates are valid
with an empty example report. OCR, visual extraction, text quality below 0.8, or
an explicit visual flag require separate visual human attestation. Human review
authority is intentionally absent from the DTO and digest.

`expectedExtractionQuality` requires exact equality of the trusted extraction's
`{score,method,needsVisualReview}` with candidate metadata. The visual-review
report derives from that matching quality object, preventing an extractor from
downgrading OCR/scans or raising confidence to bypass visual review. This trusted
context pin is separate from the DTO and must be supplied by the worker.
