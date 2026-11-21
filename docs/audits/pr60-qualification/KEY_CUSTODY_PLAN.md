# Key custody and collector enrollment plan — NOT provisioned

The operational receiver remains the separately accepted local computer, not this hosted synthetic job. No production private key is generated, read, installed or exported by this change. No Windows settings, ACL, UAC, firewall or historical laboratory change is made.

1. Independent custodian selects a new receiver storage root outside Git/candidate/old laboratory paths and independently verifies effective permissions, backups, anti-rollback policy and operator identity. A path string, checkbox or environment variable is not proof. Existing PostgreSQL is unrelated and untouched.
2. Recipient decryption and reviewer signing use different key pairs and qualified roles. Prefer an independently qualified OS/hardware-backed provider; current Node KeyObject library is not an implemented Windows hardware key adapter. If encrypted key files are proposed instead, qualify protection/passphrase delivery and storage separately. Do not put private keys/passphrases/tokens in GitHub secrets for candidate-controlled jobs or in chat/arguments/logs.
3. Deliver only the approved public recipient key and SHA256 fingerprint out of band to a trusted collector policy. Enroll exact repository/owner IDs, subject policy, caller workflow/source identities and immutable reusable collector SHA. Verify job_workflow_ref/job_workflow_sha cryptographically along with full OIDC run/attempt/check-run/source checks. A code pin alone is not independent enrollment.
4. Rotate recipient keys using explicit key IDs and short acceptance windows; revoke old collector/key policies, retain encrypted originals and signed audit receipts privately, and reject replay across attempts and restored snapshots. Offline recovery requires separate tested approval; copying current bytes or boolean approval cannot establish history.
5. Permit real confidential delivery only after independent private retention/custody qualification. Do not reconstruct raw evidence from public digests or reuse ephemeral test keys. No automatic collector startup or physical/native invocation.

## This synthetic qualification

The receiver Worker generates ephemeral RSA3072 and Ed25519 keys in RAM; only public keys leave it. Sender fetches a nonce-audience GitHub bearer, seals a four-file plain-text synthetic ZIP, and sends ciphertext through a Worker MessagePort. Private keys are never written. Same-process/host administration can still inspect memory: Worker key ownership is NOT an OS/account isolation proof. The Worker receives a minimal environment and only the separate read-only API credential it needs; OIDC request credentials stay in the sender environment.

Public artifact is a strict allowlisted summary. Token, canary, key bytes, raw claims, SQLite vault, provider capture, ciphertext and child stdout/stderr are not uploaded. Temporary encrypted journal is deleted after Worker termination. Consequently actual raw bearer/custody evidence cannot be independently recovered after job destruction; public PASS is an immutable-code producer report for this bounded test, not an independent operational attestation.

Operational key custody, trusted local receiver delivery, independent reviewer identity and native evidence collection remain UNQUALIFIED/BLOCKED. Native acceptance/G1/Book/production gates stay closed even if this synthetic test passes.
