# Book candidate human review and graph handoff

`createReviewDecision(candidate, fields, context)` reruns the candidate verifier and
returns a frozen receipt. `fields` must contain exactly `decision` (`approved` or
`rejected`), `reviewer`, `reason`, `reviewedAt` (canonical UTC ISO timestamp with
milliseconds), and `visualVerified` (boolean). The receipt adds `candidateDigest`.
`validateReviewDecision(candidate, receipt, context)` also accepts serialized JSON,
rejects unknown fields/accessors, verifies the candidate digest and source context,
and reruns all numerical and dimensional gates. Source candidates cannot carry
review fields or promote their claims' status. Approvals require valid numerical
examples; OCR, low-quality extraction or any visual-review flag requires explicit
`visualVerified:true`. A rejected contradicted candidate can still have its human
rejection recorded. Neither a successful example nor a human decision proves a
scientific claim.

Receipt JSON schema (the runtime additionally validates the actual calendar time,
digest equality, numerics and visual gates):

```json
{"type":"object","additionalProperties":false,"required":["candidateDigest","decision","reviewer","reason","reviewedAt","visualVerified"],"properties":{"candidateDigest":{"type":"string","pattern":"^[a-f0-9]{64}$"},"decision":{"enum":["approved","rejected"]},"reviewer":{"type":"string","minLength":1,"maxLength":200},"reason":{"type":"string","minLength":1,"maxLength":1000},"reviewedAt":{"type":"string","format":"date-time","pattern":"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"},"visualVerified":{"type":"boolean"}}}
```

Receipts are human workflow records, not signatures. A caller must obtain them
from a trusted local review path with appropriate filesystem permissions and
reviewer authentication. This library cannot distinguish a genuinely human-issued
receipt from a fabricated JSON object that contains all matching fields. It
rejects altered digests, invalid schema, contradictory examples and unsupported
review decisions; it does not claim cryptographic authenticity. Do not take
receipts from a PDF, extraction model or other untrusted source. The receipt's
`reviewer` and `visualVerified` are assertions that the trusted host must audit.

Read-only command:

```powershell
node scripts/book-ingestion-review.mjs --candidate work/candidate.json
```

An explicit human decision writes a new receipt file using exclusive creation,
flushes it to disk, and never overwrites an existing file:

```powershell
node scripts/book-ingestion-review.mjs --candidate work/candidate.json --decision approved --reviewer local-human --reason "Compared exact source page and numerical examples" --visual-verified --output work/review.json
```

`--visual-verified` is an explicit human assertion, never an automatically inferred
OCR result. The default command does not write a receipt or touch a graph. Logs
contain only status, hashes, page and counts; book excerpts, review reasons,
reviewer names and arbitrary error messages are not printed. Review files contain
only the strict receipt. The source pin hash covers the exact source object and
extraction version; the candidate digest additionally binds all candidate content.

To persist the decision and `reviewDecisions` metric on an existing completed
queue job, add the paired options `--queue work/local-queue --job JOB_SHA256` to
the explicit decision command. The queue's completed `result.digest` must match
the independently verified candidate before any receipt file is written. Only
then is the exclusive receipt written and flushed, followed by
`queue.recordReview(jobId, receipt)`. A missing/mismatched/incomplete job fails
before file creation. Queue options require a decision; ordinary read-only
inspection does not import SQLite or open the queue. Repeating the same output
path fails without overwriting it. The local receipt file and queue database are
two separate durable stores, not one atomic transaction: if queue recording fails
after receipt creation, retain the receipt for trusted administrative reconciliation.

`buildReviewedGraphPatch(candidate, receipt, context)` is pure and returns
`{candidateDigest,nodes,edges}`. It requires an approved matching receipt and
reruns the verifier. It produces Work, Concept, Formula, Claim and Evidence nodes,
with typed `states`, `has_concept`, `uses_formula`, `derives`, `contradicts` and
`supports` edges. Claims, formulas and extracted citation evidence remain
`untested`. Separate Evidence nodes marked `reproduced` explicitly describe only
`numeric-examples-only` and link to the relevant claim without promoting it.
All graph nodes and edges carry a source SHA-256 reference and exact JSON locator
containing source hash, edition, version, license, PDF/printed page/region,
extraction version, extraction text hash and candidate digest. Node `version` is
`candidate:DIGEST`, a bounded exact snapshot pin; full original versions remain in
the locator. IDs include the candidate digest, node kind and original ID, so
changes in edition, source, locator or extraction produce distinct graph records.
The adapter rejects patches exceeding 10,000 nodes or 20,000 edges before
materializing them, and rejects exact locator strings above 2,048 characters.
These caps preserve prior graph bounds; a structurally valid dense candidate may
therefore require smaller reviewed candidates before graph import. Tests also
check IDs at 512 characters, labels at 8,192 and node version pins at 128.
Formula nodes contain a declarative formula hash and output unit; the exact AST,
assumptions and symbol declarations are retained in the original candidate,
addressed by candidate/formula digests, rather than copied into large graph labels.
Consumers must render all labels and locator text as inert text.

`importReviewedCandidate(candidate, receipt, {repository,context})` requires a host
backend with this contract:

```javascript
repository.transact(async tx => {
  await tx.hasImport(candidateDigest); // strictly boolean
  await tx.addNode(node);
  await tx.addEdge(edge);
  await tx.markImported(candidateDigest);
});
```

The repository must serialize/lock conflicting transactions and atomically commit
all nodes, edges and the digest ledger, or roll back all writes on any error. It
must not partially commit or continue a transaction after a rejected operation.
Idempotency is per candidate digest; a second import returns `imported:false`
without node/edge writes. A receipt never authorizes executing a formula as code.
The backend remains responsible for durable candidate/receipt storage, validating
its graph schema, authenticating callers and retaining review audit history.

No production graph database is connected by this module. Missing backend throws;
there is no implicit global graph or database fallback. Tests use an injected
memory repository with full rollback to verify the transaction contract, not to
claim actual database integration or crash durability. The CLI provides a durable
local receipt file; the separate job queue retains candidate results. Linking
these stores to a production authenticated review service is host integration.
