# Paper execution value domain

The public pure predicate paper_execution_values_valid(entry, exit, quantity, fees) reuses the existing Paper _policy_decimal validator: first three positive plain finite Decimal values; fees nonnegative; coefficient at most128 digits and exponent±4096. It returns literal boolean values without coercion, foreign callbacks, caller-context changes, arithmetic or inference of PnL/units/fills/source/execution authority.

This is an additive whole-prefix extension of market_math; Monte Carlo history_statistics and v7 source-profile pins are unchanged. Ten mandatory source/wheel cases join the previous nine SDK groups. The current RootSDK127 Math420 binding is not changed. Parent owns independent QA/publication and the future report consumer pin.
