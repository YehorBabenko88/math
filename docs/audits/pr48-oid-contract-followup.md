# PR46 OID contract follow-up

Parent candidate PR48 exact02b37515c8aa13154362c3108132857677b8fe5a. Narrow port from exact PR46 ebe1d3b644c73c85dc0746e816ef65a11179cfba: preserve full Git blob OID from ls-tree, require40lowercasehex for this SHA1 repository, and keep correct OID/path capture groups. No fsck/no-replace/committed-snapshot/source-byte check removed or relaxed. No exploited provenance bypass demonstrated; this is defense-in-depth validation of malformed structured entries.

RED: existing validator accepts missing/12hex/64hex OID; new three assertions fail (5PASS/3FAIL). GREEN:9PASS/0FAIL/0SKIP each Node22.23.3/24.20.0, including real current Git tree parser regression. SHA256 repository support is not claimed; existing repository-wide source contracts are SHA1.

Separate PR45 regex fix is not wholesale merged. Its corrected contract assertions and syntax smoke are ported narrowly, retaining PR48 source pins and closed gates. Native/physical qualification not inferred. No original evidence/history rewritten.
