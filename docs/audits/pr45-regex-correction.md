# PR45 regex syntax correction

Exact base PR45 1eade92f0fdf5023e22f91766017054f9401ad6a. Node24 --check confirms Invalid regular expression flags at tests/adminit-containment.test.mjs:28. A doubled backslash ends the regex before network, which is then parsed as invalid flags.

Minimal fix uses the single regex slash escape. New independent syntax-check regression invokes only Node --check on the contract module. RED1FAIL before fix, GREEN6PASS/0FAIL/0SKIP (syntax regression +five existing contracts), Node22.23.3 and24.20.0. No assertion weakened, no native fixture or physical execution, no production/system change. PR48 remains separate and unchanged by this branch.

Raw local logs retained in the local output directory; only SHA256/byte-count metadata is published. This does not qualify hosted or physical execution. Q01 OPEN; PhysicalG1 BLOCKED; Production NO-GO.
