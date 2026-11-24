# Pure quote-book domain predicate

Base d88a6adc689ee0c9ce8951afe1e6e347294c6bf6 remains immutable. Existing market_math.py bytes (51215 bytes, SHA256 57aa2f9ad056d4773c53a1e05e52781d3390cce4dbaddaef8ed54848723e5843) remain an exact prefix; no existing helper changed.

paper_quote_book_valid(bid, ask) returns a literal bool. Both inputs must be exact Decimal objects (not bool, text, floats, ints or Decimal subclasses), finite with at most128 coefficient digits/exponents-1000..1000, each within inclusive1e-12..1e12. Bid<=ask: locked quotes are permitted, crossed quotes refuse. Hostile contexts/traps and preexisting flags remain unchanged. Unknown objects refuse without comparison/conversion callbacks.

This is the causal paper quote policy, intentionally distinct from Data orderbook_snapshot numeric input policy (strict bid<ask and1e-15..1e15). Terminan validates every entry/exit quote pair before its sole execution state changes, including unselected bid/ask sides; no dummy trade or private SDK helper is needed. Source identity, clock/freshness, quote selection, execution state and persistence remain external.

market_compute_api.CAUSAL_PAPER_NUMERIC_CAPABILITIES is immutable metadata for the six direct pure SDK functions. It does not expand JSON-RPC operations or remove JS server refusal of strategy/execution commands.

Qualification: independent literal boundary/type/context tests plus existing numerical suites and isolated installed-wheel proof. Hosted Windows/Linux3.11/3.12 workflow runs the same predicate tests against installed wheel. Actual provider/network/native execution is NOT_RUN; no source/quote/execution authority follows from true.
