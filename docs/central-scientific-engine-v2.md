# Central Scientific Engine v2

Math owns the mathematical implementation. Terminan, Strattester and Grid clients send declarative JSON and render results. No client needs a copy of the expression parser, SI algebra or numerical methods. This change does not modify those projects, fetch data, enable training/trading, install a service or authorize production execution.

## Routes and versioning

The existing loopback-only server adds `GET /v2/catalog` and `POST /v2/graph/execute`. Existing `/v1/evaluate`, `/v1/graph/execute`, `/v1/graph/ports` and `/v1/formula` retain their schemas. Invalid nonfinite legacy results and extraneous v1 knowledge fields are now rejected rather than published. `compileExpression().evaluate()` retains its behavior; the new opt-in `evaluateFinite()` checks every AST intermediate.

The HTTP server binds only `127.0.0.1`, checks the exact Host header and rejects Origin headers. It has no authentication and is not a multi-tenant or network-facing service. Do not expose it through an unreviewed proxy or interpret loopback as isolation from other local users. Port zero is available for disposable loopback tests. No PostgreSQL or external connections are used.

`/v2/catalog` returns `math.scientific.capabilities.v2`: limits, supported named ports, units, `unitMetadata:[{unit,dimensions}]`, `dimensionBasis`, supported methods and host-configured knowledge records. The ten dimensions are length, mass, time, current, temperature, amount, luminous intensity, USD, USDT and BTC. SI aliases/scales come from the existing `si-dimensions.mjs`. Assets are distinct semantic dimensions, never interchangeable currencies. Only the enumerated SI/asset units are supported; arbitrary compound-unit strings, affine temperature units and exchange rates are not implemented.

## Request

See `examples/scientific-graph.v2.json` for an executable two-formula chain. Its outputs are `[2,4,6]` and `[5,17,37]`.

Top-level fields are exact: `schema:"math.scientific.graph.v2"`, `mode:"HISTORICAL_RESEARCH"`, `execution_authority:false`, `asOf`, `nodes`, `edges`, `outputs`. Unknown fields are rejected. `asOf` and all times are nonnegative safe integer timestamps in one shared time convention (milliseconds since epoch for cross-project transport). They are caller claims, not server-observed time or source attestation.

Node IDs match `[a-z][a-z0-9_-]{0,63}`. Every supported node has one named output `value`. Connections have exact shape `{from:{node,port:"value"},to:{node,port}}`. Each input port has exactly one edge; no implicit fan-in, broadcasting or default values. Fan-out and multiple requested outputs are allowed. Outputs are references `{node,port:"value"}` with no duplicates.

| Kind | Exact additional fields | Named inputs | Behavior |
| --- | --- | --- | --- |
| source, series | type:`series`,unit,values,timestamps,availableAt,provenance | none | finite dense arrays, same length, strictly increasing times |
| source, scalar | type:`scalar`,unit,value,timestamp,availableAt,provenance | none | finite scalar with one timestamp |
| formula | expression,outputUnit | x | existing x-only mathematical AST |
| knowledge | reference:{id,sha256} | x | formula pinned to server-side source record |
| convert | unit | x | explicit same-dimension scale conversion |
| lag | steps | x | strictly positive causal lag on series |
| method | method,parameter | x | existing polynomial/sine/gaussian implementation, dimensionless input |
| average / difference | none | a,b | existing scientific experiment adapters; exact same units/types/time axis |
| multiply / divide | outputUnit | a,b | matching types/time axes; resulting physical dimensions must match outputUnit |

Every node also has `id` and `kind`. Provenance is exactly `{sourceId,version,sha256}` with bounded strings and 64 lowercase hex characters. These remain `CALLER_SUPPLIED_UNATTESTED`; supplying a digest does not prove the input came from a market, book, user, exchange or an independent observer. Clients should hash their exact input representation and retain it separately. Math binds the supplied claims and values into request/definition hashes without authenticating their origin.

No scalar-series broadcasting is performed. Scalars also return arrays of length one. A source must satisfy `availableAt[i] <= timestamps[i] <= asOf`; late revisions cannot be represented as contemporaneous observations. A lag by k returns `values.slice(0,-k)` at `timestamps.slice(k)` with the older values' original availability. Binary adapters require exactly matching timestamp arrays. Availability propagates as the maximum of input availabilities. Formulas and methods are pointwise. No centered windows, future interpolation or current/future labels are available to adapters. Changing a later observation cannot change earlier outputs. A caller can still lie about availability; independent source provenance is a separate requirement.

## Formula and unit semantics

Expressions use the existing strict parser: `x`, `pi`, `e`, numeric literals, `+ - * / ^`, parentheses and sin/cos/exp/log/sqrt/abs. There is no property access, assignment, arbitrary variables, imports, `eval`, JavaScript or executable source material. Maximum expression length is 160 characters; parser limits remain 256 tokens/nodes.

The input is converted numerically to canonical SI scale before AST evaluation, and the result is converted to outputUnit scale. Addition/subtraction require identical inferred dimensions. Multiplication/division combine dimensions. Dimensional powers require a literal integer exponent within ±16. sqrt requires even dimension exponents. Transcendental functions require dimensionless arguments; abs preserves dimensions. Constants are dimensionless: `x+1` with meter input is rejected, while `x*2` is valid. A formula `x` from km to m returns the SI-converted value, never just relabels the input. Formula `x^2` requires a supported output unit with squared dimensions. Dimensional validation does not prove a physical law or its assumptions.

The reused `evaluateFunction` methods are `polynomial: x³-px`, `sine: sin(px)`, `gaussian: exp(-px²)`, with finite |parameter|<=1e6. These are illustrative mathematical transforms, not fitted physical models. The full existing library is not exposed by dynamic method names; adding a method requires a reviewed bounded adapter and tests.

## Source-derived formulas

`createScientificCatalog(records)` is a trusted host configuration API, not an HTTP import endpoint. It connects the existing Book `assessKnowledge`/candidate digest boundary and curated concept library. The default catalog is empty: no actual book/PDF extraction is invented or automatically approved.

A record has exact fields `id,sourceId,source,status,expression,inputUnit,outputUnit,hypothesis,confidence` and optional known `conceptId`. `source` has `sourceHash,edition,page,extractionVersion,text` using the existing Book boundary. Only SOURCE_REVIEWED/FORMALIZED and `confidence:"NOT_VERIFIED"` are eligible. The host must independently establish provenance, licensing, review and the truth of source records; a status string or SHA256 is not authentication. `KERNEL_VERIFIED` and other proof promotions are rejected. Review for research use is not a proof.

The catalog hashes the whole definition, including extraction bytes/version/page, formula, units and hypothesis. Clients obtain `{id,sha256}` through `/v2/catalog`. Raw extracted source.text stays inside host catalog state; public catalog/trace expose only its candidate digest and page/edition/extractionVersion/sourceHash metadata. Execution rejects changed formula, edition, page, sourceHash or unit bindings. Clients cannot override a referenced formula or install a catalog through the graph body. `startMathEngine({catalog})` accepts only a handle created by this module. Restart/reload/cutover of a running service is outside this change.

## Results, errors and bounds

Success is `math.scientific.result.v2`, status RESEARCH_ONLY, with deterministic `order`, `requestSHA256`, `outputs`, `metrics` and `trace`. `metrics` has kind DESCRIPTIVE_OUTPUT_SUMMARIES and outputs `{node,port,unit,count,min,max,mean}` computed centrally after evaluation. These post-hoc descriptions never drive forecasts or claim predictive accuracy. Each output includes node,port,type,unit,values,timestamps,availableAt. Trace includes node,kind,definitionSHA256,dependencies (input port, upstream node, output name and its SHA256),unit,type,source provenance or null,knowledge or null,outputSHA256. Topological ties use ASCII node ID order, independent of submitted node/edge ordering. A successful numeric evaluation is not `VERIFIED`, `PROVEN`, a proof certificate or a trading permission. All authorization booleans and mathematicallyVerified remain false.

Nonfinite inputs, AST intermediates, conversions, arithmetic and results reject the whole request. There is no partial successful graph. No clamping, missing-value coercion or silent unit conversion is used. Overflow is rejected; finite underflow/roundoff remain IEEE-754 limitations. No error/condition/interval certificate is provided. Hashes use canonical JSON and are not independent attestations or signed receipts; they do not distinguish JSON-equivalent representations such as +0/-0. Results are reproducible for this pinned engine/runtime and inputs, without a cross-runtime last-bit guarantee.

Semantic HTTP failure is 422 `{schema:"math.error.v2",error:"INVALID_SCIENTIFIC_REQUEST",execution_authority:false,trading_authorized:false}`. Details/stack traces are not emitted. Transport errors are fixed codes: 403 LOCAL_ORIGIN_REQUIRED,404 NOT_FOUND,413 BODY_LIMIT,415 CONTENT_TYPE,408 REQUEST_TIMEOUT. Clients must reject every non-200, malformed schema, null/nonfinite value or unexpected authorization field. No automatic retries or execution fallback is authorized.

Limits: 128 nodes,256 edges,2048 samples per source,16384 values across all evaluated sources/intermediates,1000000 AST/adapter work units,256 KiB request,2 MiB serialized result; max128 outputs. Every node is evaluated once and counted, including unused nodes. No recursion through the DAG, no arbitrary plugins. The maximum last-node allocation is also bounded by the per-source bound; work budget is checked per node. HTTP permits eight concurrent connections, five-second idle request/header timeout and ten-second request timeout,32 requests per socket. These are application bounds, not OS resource containment or hostile same-user isolation.

## Integration qualification

Node-only Windows/Linux22/24 workflow checks the exact source SHA, committed object bytes (JS/JSON LF checkout equivalence only), raw tested hashes before/after, nonzero test counts and zero failed/cancelled/skipped tests. It publishes only a synthetic test receipt and SHA256, not raw data. It is a self-reported qualification record corroborated by GitHub job logs, not independent cryptographic attestation. A fresh trusted checkout and independent review remain required. Historical SQL bytes/checksums, PostgreSQL, Book gates, native APIs, ADMINIT, Grid and trading integrations are unchanged. Terminan rendering/proxy and Strattester consumer acceptance are independent follow-up checks.

## Revision 2.1

The additive scientific-composition revision extends named output ports, causal calculus, fixed models and bounded compound units. See docs/scientific-engine-v21.md. The original contract description above records the PR101 baseline; the revision document governs added operations and expanded unit support.
