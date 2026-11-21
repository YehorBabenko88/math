# Scientific Engine API revision 2.1

Additive extension of Math PR101 at321c4cd94d9ee0aba7a5d709042612f5ad4c5a05. The existing request/result schemas remain `math.scientific.graph.v2` / `math.scientific.result.v2`; legacy v1 routes and v2 node definitions remain supported. `/v2/catalog` advertises `apiRevision:"2.1"`, feature names, model names, actual named output ports, and unit-expression grammar. Clients must negotiate new features and reject unsupported node/port definitions rather than calculate a substitute locally.

## Verified arithmetic versus physical evidence

`examples/scientific-graph.v2.json` computes Source[1,2,3] → x*2 → x^2+1, producing [2,4,6] and [5,17,37]. This was independently reproduced locally on the pinned base and this revision. The user reports that the scenario was also physically executed. No independent physical receipt was supplied in PR101 or by the Terminan developer; that claim remains USER_REPORTED, not a newly performed or independently attested physical PASS. No ADMINIT actions were taken.

## Composition and named ports

All existing nodes retain their `value` output. New nodes are exact-field records with `id,kind` plus the fields below. Edges retain `{from:{node,port},to:{node,port}}`.

| Kind | Inputs | Fields | Outputs |
| --- | --- | --- | --- |
| sum | a,b | none | value: pointwise sum |
| rolling-mean | x | window: positive integer<=length | value: full trailing windows, no startup padding |
| derivative | x | outputUnit | value: backward finite difference, first point omitted |
| integral | x | outputUnit | value: prefix trapezoid integral, initial value zero |
| model | x | model,parameters | value: fixed pointwise map |
| overlay | a,b | none | value:a, reference:b |
| compare | a,b | none | value:signed a-b, absolute:abs(a-b), rmse,mae,bias |

Sum/overlay/compare require equal types, exact unit strings and identical timestamp arrays; no scalar broadcasting, silent interpolation, unit relabeling or currency conversion. Overlay requires series; compare supports matched scalars or series. Multiple requested ports from the same node are supported and counted independently. Duplicate `{node,port}` requests are rejected.

Each output retains the standard `{node,port,type,unit,values,timestamps,availableAt}` representation. Every comparison aggregate is a scalar at the final input timestamp, with availability no earlier than that timestamp. Feeding it into a preceding time series fails type/time-axis checks. Comparison metrics are post-hoc descriptions of supplied arrays, not proof of a forecast or an out-of-sample performance certificate. Existing root `metrics.outputs` remains descriptive only.

Multi-output node traces add `portOutputs:[{port,type,unit,sha256}]`. Existing `outputSHA256`, `unit` and `type` continue to describe the default value port. Each downstream dependency identifies and hashes the actual selected upstream output port; a MAE edge never reuses the difference-series digest. Requests with only prior v2 node kinds preserve their prior trace shape. Canonical request hashing and deterministic topological ordering are unchanged.

`examples/scientific-composition.v21.json` extends the known chain with a trailing two-point mean, a lag, overlay and comparison. Expected values: square[5,17,37], mean[11,27], prior[5,17], differences[6,10], MAE8, RMS sqrt68≈8.24621125123532. This is synthetic mathematical composition, not a fitted or traded model.

## Causal operators and model assumptions

All graph timestamps are UTC milliseconds in one shared convention. Derivative computes `(currentSI-previousSI)/(elapsedMilliseconds/1000)` and converts explicitly to outputUnit; irregular positive intervals are supported. Integral uses each observed pair's trapezoid area over elapsed seconds, accumulates the prefix and converts to outputUnit. These numerical approximations assume linear interpolation between observed samples; they do not prove a continuous physical law, bound discretization error or qualify a market interpolation policy.

Rolling mean uses only the fixed trailing window. No global or future normalization, centered windows, fitting, adaptive selection or labels are available to these operations. Availability propagates from every value used; integration uses prefix availability, rolling mean uses window availability. A later suffix mutation cannot change earlier outputs. Source availability remains a caller-supplied UNATTESTED claim; Math does not authenticate when a real observation became known.

Fixed models:

- `affine`, exact parameters `{gain,offset}` with each finite and absolute<=1e6: y=gain*x+offset. Gain is dimensionless; offset is explicitly in the input unit, and the output retains that unit.
- `landau-map`, `{mu,beta}`, |mu|<=100,0<=beta<=100: y=x+mu*x-beta*x³.
- `logistic-map`, `{r}`,0<=r<=4: y=r*x*(1-x).

Nonlinear maps require dimensionless physical input, convert it to canonical dimensionless scale and output `dimensionless`. They are fixed pointwise maps, not a recursive time simulation, continuous Landau ODE, trained method or automatic forecasting system. No x-domain clamp is performed. Outside a model's scientific validity domain a finite numeric result still conveys no scientific credibility. Every intermediate must be finite; unstable/extreme inputs reject the request. The prior polynomial/sine/gaussian method nodes now use an opt-in checked Math wrapper and canonical dimensionless scaling, rejecting hidden infinite exponents; legacy evaluateFunction itself is unchanged. These additional mathematical kernels live only in Math; existing numerical/fit APIs are not rewritten.

RMS residual calculation rescales by the maximum absolute residual before summation to avoid gratuitous squared overflow. Mean/MAE and other calculations remain IEEE-754 approximations, without an interval/condition/forward-error certificate. The entire request fails on nonfinite intermediates/results. Finite underflow and roundoff are not claimed eliminated.

## Dimensions and compound units

The existing SI catalog is retained; cm,mm,ms are added to the scientific interface. Bounded grammar supports known atoms joined left-associatively by `*` and `/`, with optional nonzero integer powers -8..-1 or1..8. Examples: `m^2`, `kg*m^2/s^2`, `m*s`, `USD/BTC`. Maximum96 characters,8 factors,absolute dimension exponent16. No whitespace, parentheses, arbitrary prefixes, exponent expressions, affine temperature units, exchange rates or implicit multiplication. Existing named unit aliases continue to work.

USD,USDT,BTC remain separate semantic dimensions. USD/BTC can describe a ratio; it cannot authorize a USD→USDT or BTC→USD exchange. Formula dimensions, calculus output dimensions and explicit convert nodes all use the same central unit parser. Book formulas can now declare compound units such as m^2; source fingerprint/page/edition/extractionVersion/hypothesis/confidence checks remain unchanged.

Consumers obtain dynamic unit descriptions from `POST /v2/units/describe` with exact JSON `{schema:"math.units.describe.v1",execution_authority:false,units:[...]}`. Require1..16 unique bounded unit strings. Success is `{schema:"math.units.result.v1",units:[{unit,factor,dimensions}],execution_authority:false,trading_authorized:false}`. Invalid requests use the same fixed v2 semantic HTTP422 error. `unitSyntax` in capabilities describes the grammar; consumers need no copy of unit algebra.

## Limits, provenance and readiness

The original128-node/256-edge/2048-point/16384-total-value/1e6-work-unit/256KiB-request/2MiB-result bounds remain. Every emitted port, including unrequested comparison/overlay ports, counts against total values. New operation work is reserved before computation; rolling work includes every window term. No dynamic adapters, external code, network data reads or source-content commands are executed. Supported operation definitions are versioned engine code, not editable caller plugins.

Book catalog is still host-configured and empty by default. SOURCE_REVIEWED/FORMALIZED entries are hypotheses with confidence NOT_VERIFIED and mathematicallyVerified:false. Raw extraction text is not exposed by public catalog/trace. SHA256 binds definitions/data but does not authenticate books, licenses, people, exchanges or computers. No numeric outcome is promoted to VERIFIED/PROVEN.

Terminan and Strattester should pin this Math source SHA, negotiate capabilities, send bounded inert JSON and render returned ports/metrics. They must not duplicate mathematical algorithms. Full cross-project/hosted acceptance remains distinct from local contract tests. No ADMINIT, PostgreSQL, Grid, production services, Norton, UAC or physical G1 is changed. No merge or deployment is performed.
