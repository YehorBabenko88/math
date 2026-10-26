# PR60 log privacy review

Run: `40298775250`, attempt **1**; exact head `b24d2d6ca264926c1a65a96f574057192bfeca03`. GitHub GET metadata confirms completed/success, **4 of 4 jobs successful**, and **0 artifacts** (queried, not assumed).

## Findings

- **P2 — Runtime PID disclosure in inherited Node warnings.** All four combined job logs contain process identifiers in Node warning prefixes: **16 occurrences** total. Eight are `punycode` deprecation warnings around setup-node and its post phase (two per job); eight are experimental SQLite warnings in receiver contract test output (four per Node 22 job, zero per Node 24 job). These are actual runtime identifiers, not synthetic fixture labels. They prevent a strict claim that these historical logs contain no PIDs. A later logger or warning-suppression change cannot redact this completed run; its effectiveness needs a separately inspected run.

- **P2 — System account paths remain in GitHub-managed output.** Sixteen Unix account-path occurrences appear across the two Ubuntu logs (eight each), in checkout/Git setup and cleanup. These are runner infrastructure metadata, not evidence of an application payload or real user account leak. No Windows user-account-path pattern matched. Job metadata can separately contain runner names; the committed metadata intentionally excludes them.

- **No P1 application secret disclosure established by this scan.** JWT-shaped strings, private-key headers and native SID patterns each have zero matches. Six broad bearer-pattern matches are the harmless test title describing absence of bearer/raw evidence in an envelope (two TAP title/result repetitions per Node 22 job and one title per Node 24 job); they are not credentials. This classification concerns displayed test-description strings and does not certify every possible secret format.

## Per-job scan counts

Counts are regex occurrences across each entire downloaded combined stdout/stderr log, including setup and post phases. Raw values are never reproduced here.

| Job ID | Matrix | Lines | Bearer-like title | PID warnings | Unix account paths | JWT / private key / SID |
|---|---|---:|---:|---:|---:|---:|
| 121491235562 | receiver-contracts (windows-latest, 22) | 791 | 2 | 6 | 0 | 0 / 0 / 0 |
| 121491235797 | receiver-contracts (windows-latest, 24) | 266 | 1 | 2 | 0 | 0 / 0 / 0 |
| 121491235829 | receiver-contracts (ubuntu-latest, 24) | 279 | 1 | 2 | 8 | 0 / 0 / 0 |
| 121491235847 | receiver-contracts (ubuntu-latest, 22) | 804 | 2 | 6 | 8 | 0 / 0 / 0 |

## Downloaded log hashes

Hashes identify the locally saved UTF-8 text emitted by `gh api`; they are not claimed to be archive transport-byte hashes. Raw logs and unsanitized API metadata stay in the private local `outputs/pr60-privacy` directory and must not be committed or published.

| File | Bytes | SHA-256 |
|---|---:|---|
| job-121491235562.log | 51157 | `0aee66b0ccf62bbfe780fa3b07e7b3af0c59fa95342244ffb82b6f1307c59f26` |
| job-121491235797.log | 24353 | `89de6aed65acde5742325aa515b3e8c09b3eb24ce85af9127de3f52f66549842` |
| job-121491235829.log | 24579 | `86b3c2a261b09c2002157a18cf0872a2e73e8b55515fddf5830cff6da584dad9` |
| job-121491235847.log | 50878 | `4e0e25305efa499daf044f31b042c3072a7edba194e918d26f141e4c7adff0cd` |

## Scope and limits

Read-only GitHub API GETs fetched run metadata, all attempt-1 jobs, artifact metadata, and all four job log endpoints. No test, application, native executable, database, ADMINIT, PG, Q01, full npm suite, workflow dispatch, rerun, cancellation, GitHub write, or source/workflow change was performed for this review. The scan covered all 2140 returned log lines, with anchored pattern matching for bearer-like text, JWT triples, PEM private-key headers, Windows SID syntax, Node PID warning prefixes, and Windows/Unix account-directory syntax. Escaped/encoded variants, arbitrary secret formats, unlogged runtime state and deleted/unavailable historical material remain outside this bounded review. GitHub combined logs do not permit reliable separation of stdout from stderr. Zero artifacts does not imply zero sensitive log content. This is not a blanket privacy certification.
