# Scientific Engine v2.1 readiness

Base: Draft PR101 exact321c4cd94d9ee0aba7a5d709042612f5ad4c5a05. Own feature branch, no mutation of the control PR. Final HEAD/tree and exact-head hosted observation are recorded in the new Draft PR/CI receipt rather than a self-referential report hash.

## Implemented scope

Math remains the only numerical engine. Added typed sum, fixed trailing mean, backward derivative, prefix trapezoid integral, fixed affine/Landau-map/logistic-map composition, multi-port aligned overlay and comparison. Comparison emits signed/absolute residual series and final-time scalar RMS/MAE/bias. Every port is independently connectable, hashed and counted in resource limits. Added bounded compound-unit grammar and engine-owned /v2/units/describe so consumers need no unit algebra implementation. Original graph/formula/knowledge routes and nominal prior v2 graphs retain behavior.

Existing Math AST, dimensions, experiment adapters and proof/Book boundary remain authoritative. No model fitting or future normalization is introduced. Book source ID/page/edition/extraction version/hypothesis/confidence are retained, pinned definitions reject substitution, and successful computation never makes a source VERIFIED or PROVEN. Host Book catalog remains empty by default and raw source text remains private.

## Scenario evidence boundaries

User reports physical Source[1,2,3]→Formula(x*2)→Formula(x^2+1). Independent local reproduction returned[5,17,37] at the base and this implementation. Available PR101 comment is specification agreement only. The Terminan developer also reported isolated local browser real-Math checks but supplied no independent installed ADMINIT receipt. Thus physical result is USER_REPORTED, receipt NOT_PROVIDED; no new physical run or attestation is claimed.

The published synthetic composition example additionally produces trailing means[11,27], lagged values[5,17], differences[6,10], MAE8 and RMSsqrt68. Its full result and provenance hashes are regression-checked. Three independent old-v2 cases (original chain, source-only, explicit km→m) match pinned PR101 output exactly. This is selected-case parity, not an exhaustive compatibility proof.

## Findings and RED/GREEN

- Feature RED: nine of ten initial composition tests failed on unsupported operations, named ports and compound units; the existing chain passed. Implemented bounded adapters and typed port dispatch; GREEN.
- API RED: /v2/units/describe returned404; implemented strict fixed-schema unit metadata and v2 errors; GREEN.
- P2 confirmed qualification gap: committed example data could be changed with assume-unchanged without invalidating source identity. Disposable git fixture RED returnedPASS despite changed example. Runner now binds example/golden JSON to committed blobs and rejects untracked inputs; GREEN. Existing --no-replace-objects/mode/link/JS-JSON-EOL/before-after protections remain. Historical SQL/ledger bytes are untouched.
- P2 checked-runtime gap: a Gaussian method could hide an infinite exponent behind finite exp(-Infinity). Separate RED confirmed it; an opt-in evaluateFunctionFinite wrapper checks actual intermediate evaluation order, while legacy evaluateFunction remains unchanged. New scaled dimensionless compound units also exposed raw/canonical method mismatch; a RED100cm/m sine case now uses canonical input and preserves output scale.
- Numeric test correction: initial MAE expectation assumed exact associativity of7/3; scaled-sum result differed by one ULP. Mathematical tolerance is explicitly1e-15, retaining analytic assertions rather than treating IEEE-754 rounding as an application defect. No convergence/forward-error guarantee is claimed.
- Independent read-only review found no concrete new-operation/API blocker. It requested additional coverage now present: rolling work budget, all-port value accounting, calculus/model/sum/comparison overflow, irregular-time and suffix invariance, scaled units, final aggregate availability through transforms, grammar complexity and invalid metadata requests. Reviewer did not independently qualify hosted/physical execution.

## Matrix

- Local Windows Node22.23.3:158PASS,0FAIL,0SKIP,0CANCELLED across31 bounded mathematical/knowledge/loopback/receipt files.
- Local Windows Node24.20.0:same158PASS,0FAIL,0SKIP,0CANCELLED.
- Original v2 selected compatibility:3PASS.
- Source→Formula→Formula arithmetic:[5,17,37] reproduced locally; physical receipt NOT_PROVIDED.
- Hosted Windows/Linux22/24:workflow configured on the final PR source SHA; actual status to be checked after publication. Queued/absent/skipped is not PASS. No old SHA artifacts will be reused.
- Full npm test, physical ADMINIT, native/C#/PowerShell, Q01 stress, PostgreSQL, production and Grid operations:NOT_RUN/out of scope. Only disposable loopback and local temporary git fixtures are used.

## API coordination and blockers

User authorized direct API coordination. Terminan developer received the additive2.1 node/output/unit/time contracts. A Strattester integration contact received the same protocol boundary; no consumer code is changed here. Final pin/specification will be sent after commit. Consumer acceptance/pin uptake remains separate until acknowledged and tested.

The default book library still needs genuinely reviewed/licensed/provenance-checked source records. A reviewed status string and SHA256 are not authentication or proof. Models are fixed pointwise maps, not recursive state models, fitted forecasts or validated physical laws. Trapezoid/difference approximations have no error certificate; finite underflow/roundoff remain. Multi-batch causal context must be supplied explicitly by callers; there is no hidden state or automatic lookahead. Loopback is not authentication or OS isolation.

Code is prepared for independent integration review. Integration acceptance remains conditional on exact-head hosted results and consumer checks. Q01OPEN, physicalG1BLOCKED, ProductionNO-GO, BookgateCLOSED. No merge, deployment, real PostgreSQL or ADMINIT modification.
