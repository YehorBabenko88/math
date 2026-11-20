# Strict type identity refusal

A follow-up pure-source probe found that tuple membership on `type(value)` can invoke an arbitrary metaclass equality callback. The new scalar predicate now uses `is` checks before the existing numeric conversion. Two hostile metaclasses are covered inside the original six new cases. The pre-existing Math140 kernel prefix and all original kernel tests remain unchanged. This fixes callback refusal; it does not grant source, native, trading or execution authority.
