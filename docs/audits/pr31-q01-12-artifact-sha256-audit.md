# Independent Q01 artifact ZIP audit — PR31

Candidate source HEAD: `cb168925b5aeec0c957137dd94ab72c64f0bd333`.
Reported tree: `10cfd29f5d2c75e841d88dd70bef8773dada8287`.
GitHub Actions run `40183990649`, attempt `1`.
Execution head in all reports: `1b99e5c85bc8b98d0ea2552d3cf1f6dab470dd13` (PR merge context; not equivalent to source SHA without independent attestation).

## Original downloaded ZIP evidence
Each ZIP was independently opened; SHA256 of original ZIP bytes and manifest-listed `events.jsonl`, `junit.xml`, `report.json` recomputed and matched. XML parsed and cases/failures/errors/skips independently counted; report cases all PASS. No physical work.

| Artifact ID | OS | Node | Profile | Cases | ZIP SHA256 |
|---|---|---|---|---:|---|
| 12594909670 | Linux | 24 | quick | 7 | 0234be45f0040bcf0969a475ce065068732e0a143fb887b4f770f67e84a10708 |
| 12594974702 | Linux | 22 | stress | 3 | 36ee2380ed95b3dab73a767738524d44b718c5d957565d53d44f940c4e3f1715 |
| 12595209223 | Linux | 22 | quick | 7 | adb24b1091ba0466039252a7900df9db2fbd75ef27622d53af870e0fafee5ede |
| 12595257940 | Windows | 22 | fault | 22 | 8bf49aef5fb376e27c2dce514c54929b965aa9f542a37a70f0f9ea5296129c64 |
| 12595402582 | Windows | 24 | stress | 3 | 2d9164175b3b4f7af79096e23beb25435ef888473b742837a990e82e3a8d9bb5 |
| 12595422040 | Windows | 22 | quick | 7 | c44da37a4a457963ac740b9de0d9e2d2860650fbe63756158243ce2c64cbb3bc |
| 12595547609 | Windows | 22 | stress | 3 | da90cdd5da2d30285c293c04173e437475c957465ea96b21d4340e9f5302d0d6 |
| 12595825309 | Linux | 24 | fault | 22 | 8a12ee2d0cc92c0a88026f50b61f7f8742812863f9edee9574e32684dc098496 |
| 12595860969 | Linux | 24 | stress | 3 | 5719bd7a38e5776343f96db7cbb5bf0606ebb59c72951b64360d9bf1623df15a |
| 12595881099 | Windows | 24 | fault | 22 | ab9a777083353b660e27dcf4c258fc259f8311505408770e8e06a6b038c992ab |
| 12596115087 | Linux | 22 | fault | 22 | f5a5d8635946d5ce27b7d29db05e331e2937760f36abb41621acacc4ae2152bf |
| 12596140478 | Windows | 24 | quick | 7 | 3109484847118fd978f6c4ce88f012f3d7bd1483567311e115b9361636111100 |

Total 12 ZIP, 128 JUnit cases, zero failure/error/skip, all reported cases PASS, all manifest digests matched. JSONL files parsed (counts: quick 390 each; stress 33606 each; fault 16231/16239 Windows and 18734/18865 Linux).

**Bounded verdict:** Q01_SYNTHETIC_ARTIFACT_CONTENT_PASS_ONLY. The GitHub workflow completion/coverage aggregator, trusted source SHA/tree linkage, other CI matrices and physical tests remain separate acceptance gates. Q01 OPEN, Integration NO-GO, Production NO-GO.

The previously alleged swallowed BOOK_QUEUE_INITIALIZING P1 remains RETRACTED. No merge or deployment authorized.
