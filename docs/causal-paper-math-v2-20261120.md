# Causal paper numerical contract v2

Base: de8194f71311a6d7dddb69be9de812030ed1f13f. The original market_math.py raw bytes remain an exact prefix, hash d1236748dfaee6bafc64fab7bbec74bedfd0e597bb5b238e3505b2e942cb7b60. The namespace test now checks that immutable prefix plus unique top-level definitions, permitting append-only feature extensions without shadowing old kernels.

Pure named results contain no engine, journal, persistence, timestamps, source authentication or execution authority. Terminan owns selected chronological funding events, causal history and its sole PaperEngine. Data owns source/schema/time/provenance and availability, including null funding.

## Source map and intentional v2 policy

Strattester 25eb939f8a816a80ac7c042ce75ec4d9173cd4ce research/quote_paper.py and paper_account.py supply unique quote fees/funding and causal balance policy. Grid 204897c9f3f6ccaf33ae6d02415b97d0049d7e1e grid/book_tape_research.py and grid/lab_observation_export.py supply feature/vote and numeric input consistency policy. These historical modules are not imported or packaged.

QuoteMetrics(entry_price, exit_price, qty, signed_qty, gross_raw, gross_fill, slippage, fees, funding, net): fixed28 HALF_EVEN each operation. Fee order qty*(entry+exit)*bps/10000. Funding selected mark/rate pairs max128, no inferred schedule completeness. This is an explicit decimal v2 model, not a claim of old binary64 bit parity. Prices/marks 1e-12..1e12, notional 1e-9..1e12, fee/slippage 0..1000bps, funding rate -1..1; bounded Decimal inputs; derived qty/financial values abs<=1e15.

AccountBalances(cash, peak, reserved, available_cash): exact sums; only ordered settled PnLs update peak, pending PnLs affect cash only. Bounded list/tuple batches max20000.

ReservationMetrics(collateral, spread_bps, spread_exceeded, reservation_exceeded, cash_insufficient, drawdown_exceeded): exact admission comparisons, including integer cross-products for spread; spread display28HE. Spread denominator is bid. Collateral notional*(1+fee_bps/10000). Locked bid=ask is allowed by this numerical helper, while Data BOOK domain requires bid<ask.

BookTapeMetrics(relative_volume, delta_ratio, base_width_fraction, proxy_poc, proxy_poc_distance, effort_anomaly, volume_confirmation, breakout_long, breakout_short, trend_long, trend_short, long_votes, short_votes, signal): history4..4096; exact feature/vote thresholds, first-seen POC; display6/8HE. Time/window/warmup eligibility stays Terminan.

paper_input_numeric_integrity(kind,payload): numeric-only predicate for trade_tape_250ms/orderbook_snapshot/derivatives_ticker. Strict valid domains precede original binary64 isclose(rel_tol=abs_tol=1e-9) consistency. Counts strict nonbool integers within JS safe range and exact partition. Signed zero is numeric zero, tiny negative unsigned strings refuse before float underflow; positive prices underflowing binary64 refuse. Present-null funding is valid unknown data, never funding availability proof.

## Qualification boundary

Reviewed pure numerical suites only. Local native/service/provider/HTTP/Postgres/Consul tests are NOT_RUN. Existing historical kernels remain byte-preserved. Hosted wheel workflow adds the same causal literal/domain/context regressions against installed wheel on Windows/Linux Python3.11/3.12; hosted success is not assumed.

## Independent review correction

The original 9de5f8c candidate rejected valid wide market amounts when multiplying peak by (1-max_drawdown): that exact product can need5001 digits, beyond the4300-digit sum context. The correction compares (peak-available+collateral)/peak > max_drawdown by integer cross-products. It neither widens global contexts nor rounds admission thresholds. Independent Fraction regressions cover36 combinations of4001/4263-digit amounts, exponents -2000/-1900, zero/tiny/unit drawdown, positive/nearzero cash and hostile caller contexts. Original9de remains historical candidate evidence, not acceptance of this valid-domain edge.

Exact Decimal ordering also precedes conversion for BOOK bid<ask and TAPE OHLC envelopes. Independent regressions reproduce binary64 collapse: valid tiny BOOK spreads previously refused; invalid tiny OHLC-envelope violations previously passed. Only declared TAPE delta/range/imbalance consistency remains legacy approximate binary64.
