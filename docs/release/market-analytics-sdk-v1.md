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
