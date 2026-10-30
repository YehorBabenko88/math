# D: Independent bounded Math experiments

Base: Math PR97 b92cd96ab5a8cab048524b311f565f4fe1937b1f. Existing numerical engine and research semantics remain source owned. `/v1/experiments` accepts the same `math.evaluate.v1` contract and returns the same `math.result.v1` response. It launches only an isolated JavaScript computation worker, never a module, native process, exchange connection or trading command. Input <=262144 bytes and 500–2000 observations. Deadline <=5000ms and disconnect cancellation terminate the worker. The four-worker admission slot remains occupied until worker termination acknowledges completion. Experiment bodies have an absolute 1000ms receive deadline; HTTP headers/requests are bounded to 5000ms. Existing engine APIs remain compatible.

| Migration | Result | Remaining |
|---|---|---|
| PR97 evaluation engine | Delegated without replacement | P1 broader numerical qualification |
| Independent compute lifecycle | Per-request worker/deadline/cancellation | P1 durable experiment history outside scope |
| Read-only dashboard Math status | Contract integration with source release pin | P0 physical operator admission remains blocked |

SOFTWARE: bounded disposable tests; SOURCE_PROVENANCE: base repository identity pinned, caller observations UNATTESTED; PHYSICAL: NOT_RUN; PRODUCTION: NO_GO. CI SUCCESS does not attest observation authenticity or qualify physical runtime. No order/trading authority or automatic G1.
