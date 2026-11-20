# Pure supplied funding-row domain

Base7b2e89b2818388913953ededbe106a225ec78ec9 stays immutable. Its entire market_math.py (51719 bytes, SHA256 b43c5d98c9a3e7c75682b5a395f16cd80d3e40b3058c8f52bf172812dccac3fe) is an exact prefix; existing helpers unchanged.

paper_quote_funding_valid(mark,rate)->literalbool validates finite exact Decimal inputs, at most128 coefficient digits/exponents-1000..1000. Mark is inclusive1e-12..1e12; signed rate is inclusive-1..1, including numeric negativezero. Wrongtypes/subclasses/NaN/infinity/outdomain refuse without comparison or conversion callbacks. Caller precision/traps/preexisting flags remain unchanged.

Terminan owns temporal selection and COMPLETE_EVENTS assertions. It must validate every supplied funding row before its sole controller commits state, including rows outside the selected entry/exit interval. The predicate neither infers a schedule nor grants source/completeness/quote/execution authority. paper_quote_metrics continues to receive already selected chronological events. No dummy trade or private SDK helper is needed.

Public reexport and immutable direct-SDK capability metadata include the new function. No strategy/execution RPC or JS command guard changes. Tests cover literalbounds, signedrates/zero, stricttypes/nonfinite/encodinglimits, hostilecontexts and exact oldprefix. Source/isolatedwheel qualification only; native/provider/network NOT_RUN, fullreleaseNO_GO.
