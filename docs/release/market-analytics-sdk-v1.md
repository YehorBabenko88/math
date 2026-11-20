# Pure market analytics SDK contract

Canonical owner: Math. Terminan owns DTOs, time admission, source quality, UI and state; these helpers confer no source trust or trading authority.

- minute_volume_update(volume, quote_volume, buy_volume, sell_volume, bucket_volume, price, size, side) returns five totals in that order without mutation. Buy/1 and Sell/2 aliases are classified; other bounded strings are unknown.
- footprint_cell_update(buy, sell, quantity, taker_side) returns two exact totals; only Buy/Sell are admitted.
- exact_sum(values) consumes at most one million bounded finite Decimal amounts once, retaining no event history. Negative values are permitted for signed deltas.
- wall_notional and executed_volume_delta own exact products/differences. flow_window_metrics and tape_velocity_metrics retain their existing data shapes.
- tick_distance returns a display ratio. within_tick_distance performs an exact proximity comparison: never admit a source/observation from a rounded display value.
- book_summary_metrics(bids, asks, tick) returns best_bid, best_ask, spread, bid_notional, ask_notional. Empty sides yield None for missing best/spread; crossed or nonfinite books are refused. Each side is bounded to 20,000 levels.

Price, size, tick and proximity inputs: positive/nonnegative as appropriate, at most 128 coefficient digits and exponent -1000..1000. Accumulated amounts/products: at most 4270 coefficient digits, exponent -2000..2000, adjusted magnitude at most2262. All bounds are checked before exponent alignment. Oversized, nonfinite or negative quantity DTOs are refused.

SDK rates/distances/ratios use an explicit 28 significant digit HALF_EVEN policy independent of caller context, flags and traps. The existing math.market.compute.v1 JSON adapter explicitly selects96 digits for its historical tape/flow/wall ratio contract. Supported policies are exactly28/96; no ambient context is consulted. Volumes, notionals, deltas and boundary comparisons remain exact.

Validation is pure Python only. No exchange, database, native process, service, installer or security setting is touched by these tests. Old Meta PaperEngine is not copied into Math.

Source-specific compatibility policies remain in the same Math implementation: price_bucket(...,rounding="half_even") preserves the data builder tie rule; default remains HALF_UP for minute/footprint analytics. volume_profile_poc(...,tie_policy="first_seen") preserves data-builder insertion-order POC ties; default remains lowest-price or nearest-close. Passing close with first_seen is refused. Decimal input normalization fixes prior float-division noise; it is not a claim of every binary64 rounding artifact being preserved.

The Math historical_aggregate_integrity(row) helper owns the historical binary64 footprint partition, OHLC range, POC membership/max-volume and quantity-delta policy. It preserves math.isclose default rel_tol=1e-9 and abs_tol=1e-9, plus inclusive eight-ULP price boundaries. It does not authenticate a producer, establish event continuity, enforce JSON byte budgets or authorize execution. The old source function at market-data fa09e6883fe2af073237cb0e105900c7b2e2c2fa is retained only as a hashed test oracle (excluded from wheels); literal boundary and malicious DTO tests are independent of that oracle.

Strictly positive level/POC prices are validated before the historical eight-ULP comparison. At the minimum subnormal positive binary64 price, that tolerance cannot cross zero to admit 0, negative zero or a negative price. Positive prices at the inclusive eight-ULP boundary remain valid; nine ULPs remain refused. This intentionally closes an invalid-domain loophole in the retained source oracle, rather than treating historical source behavior as authority over the market DTO domain.

Integrity field domains are checked before approximation: all OHLC/level/POC prices are strictly positive; header buy/sell and per-level buy/sell/total volumes are nonnegative (signed negative zero denotes zero); delta remains signed. Header trade_count is a positive non-Boolean integer, per-level side counts are nonnegative non-Boolean integers. NaN, infinities and Boolean numeric substitutions are refused. Approximation is preserved only inside these domains, so a tiny negative unsigned amount cannot be admitted merely by absolute tolerance. The complete field matrix is covered alongside source parity and hand-oracle ULP/quantity boundaries.
