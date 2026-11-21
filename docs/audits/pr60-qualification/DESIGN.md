# PR60 hosted confidential qualification design

PR60 remains immutable control b24d2d6ca264926c1a65a96f574057192bfeca03. New branch is limited to pure receiver/collector contracts and one synthetic live-OIDC workflow. No native, ADMINIT, Q01, PostgreSQL, browser, PDF, production or full-suite test is invoked by this qualification branch. Twenty unrelated job declarations have explicit branch-only exclusions; they are SKIPPED/NOT_RUN, never evidence of success. Other branches retain their previous job conditions. There is no full-project GO.

## Collector trust and actual data

The caller will pin a reusable workflow at immutable commit C. That workflow contains a literal SHA256 source map, downloads ONLY exact regular Git blobs through the fixed GitHub API, verifies every imported dependency, then executes the trusted entry. It does not checkout or run candidate code. Bearer requests occur only afterward. Caller inputs are not operational enrollment; the synthetic run verifies signed job_workflow_ref and job_workflow_sha against C, plus existing strict OIDC and independent run/job/attempt/source graph checks. Two exact documented subject forms may be selected only after signature verification and match against independently fetched repository/owner IDs.

Only the new collector job gets id-token:write; contents:read is the only repository resource permission. No inherited secrets, cloud resource exchange or production credentials. Existing token, nonce/time/issuer/subject/source/job/tree checks are preserved; unsupported real issuer forms fail closed. Safe blocked diagnostics expose only types/boolean comparisons from a last signature observation, never raw claim values. They are not authorization.

## Synthetic E2E

The sender requests one nonce-audience real GitHub OIDC bearer. A separate Worker owns ephemeral RSA/Ed25519 private keys, private journal and receiver verification. The sender receives public keys/challenge only, creates a four-file plain-text synthetic STORE bundle, seals it and sends ciphertext through MessagePort. The Worker independently re-reads platform/JWKS and verifies signatures, reusable pin and source graph. It checks replay, source/run/attempt/job/check-run mismatches, unsigned/wrong-key receipts and corrupted ZIP; valid baseline is verified before and after mutation checks so expiry cannot masquerade as negative success.

This tests process transport on a disposable hosted machine, not local receiver delivery or OS/account isolation. Worker keys are not production custody; no private key/raw bearer is retained for independent review after job destruction. No native evidence is fabricated or labelled measured; synthetic kind/scope is mandatory and native/production gates stay closed.

## Privacy boundaries

The trusted bootstrap captures child stdout/stderr and allows only fixed success/blocked sentinels. Worker streams are never forwarded. Public artifact is one strict-schema JSON file; upload is enabled only after schema and transcript validation. No raw claims, JWT, ciphertext, private keys, canary, journal or native PID/SID/ACL records. NODE_NO_WARNINGS suppresses real PID warnings only; exceptions and exit codes still fail. GitHub infrastructure logs remain separately audited and may contain standard hosted paths; this is not a global privacy certificate.

No key provisioning, Windows/system configuration change, workflow cancellation/rerun, source PR update, deployment or gate activation is performed. Operational confidential receiver, collector enrollment, real key custody and private reviewer channel remain UNQUALIFIED.
