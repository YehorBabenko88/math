# Provided historical ledger binding

The independent same-count counterexample changed one retained historical case name and the matching current row. Before this fix verifyTransferLedger accepted the supplied object even though the original188 proof and1234 raw ledger stayed unchanged. Overall runtime coverage remained HELD; this was a metadata false acceptance, not workload authentication or a runtime grant.

The verifier now reads the immutable historical ledger bytes, binds their Git blob SHA1 to the exact b3 tree before deriving any identity, deep-compares the provided historical object to that decoded record, and uses a detached trusted snapshot for all subsequent derivation. No historical hash or case count is repinned. The unchanged independent probe is archived here as inert .txt; on the old a695 helper it reports accepted=true, on this descendant accepted=false.

Nine existing configuration/metadata cases remain the same case identities and pass locally; all207 current test-source hashes, the188 original reconstruction and both historical ledger bytes are unchanged. No OIDC, key generation/signature, SQLite, native app, provider or full matrix executes in these checks.
