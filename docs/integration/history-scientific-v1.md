# Joint historical and scientific contract

Both APIs execute from one immutable Math commit/tree. This branch starts at
Scientific #102 `1f97e56701c0fce01dc8dd05952111fa8df3f2d1` and cherry-picks the
additive historical #100 changes from `3a9c542841e160f8b1924f155aaa2d1a676dfd04`.
No live source ref, PR merge or deployment is involved.

`python -I -S python/history_scientific_worker.py <absolute-node-executable>` reads
one bounded JSON object with exact fields `schema`, `history`, `graph`.
Schema is `math.history.scientific.request.v1`; history is the existing historical
v1.1 request. Graph has `nodes`, `edges`, `outputs` and references the reserved
`history.value` source. Additional sources and the reserved ID are rejected.
Every formula, model, combination and comparison is evaluated in Math v2.1.

The injected source contains actual event ends and first availability, unmodified.
The Scientific admission rule now permits publication after event time but rejects
event or availability after asOf. Existing instantaneous source results are unchanged.
Math history additionally rejects decision >= the next event horizon: a delayed
observation is not a future forecast after that horizon. This worker offers a
one-minute forecast only; fixed scientific maps do not become forecasts.

Result `math.history.scientific.result.v1` includes original history result,
scientific result, full row provenance, dataset and snapshot IDs, source revision,
market, units and decision time. It does not authenticate source receipts or grant
training, execution or trading authority. Book-backed hypotheses retain the existing
independently provisioned catalog requirement; arbitrary book claims are not installed.

Limits: 2 MiB joint input; 256 KiB scientific request; 2 MiB scientific result;
4 MiB joint result; eight-second Node subprocess timeout; engine graph/work limits.
Caller separately pins Python/Node executables and extracts both APIs from the same
immutable Git tree. Strattester owns OOS accounting and Grid owns source admission.
