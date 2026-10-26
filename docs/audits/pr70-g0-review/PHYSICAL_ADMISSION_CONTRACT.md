# Physical admission contract — design only, not an Execute mechanism

Status: DRAFT / NOT_IMPLEMENTED / NOT_ACCEPTED. Q01 OPEN; Physical G1 BLOCKED; Production NO-GO; Book gate CLOSED.

## Separate evidence classes

1. Operator terminal report and SHA256 identify reported bytes only. Without original bytes, origin, clock and collection process are not independently established.
2. Normalized G0 JSON is an unattested observation. Its checksum is neither a computer attestation nor a statement that OS isolation is effective.
3. Read-only inspection can establish bounded configuration observations. It cannot create a missing isolation boundary or guarantee that sampled state persists.
4. Future admission requires independently accepted, currently enforced predicates and separate explicit authorization. No v1 snapshot, all-PASS checks, signed self-report, environment variable or this document supplies it.

## Required physical admission record

A future private record must bind a unique request/run identity, exact approved source HEAD/tree and synthetic package inventory/digest, fixed executables/arguments, target isolation resource identity, protected-resource policy/version, intended token identity/class, observer trust/custody, independent authorization with expiry/scope, monotonic duration bound, baseline predicates and continuity evidence. No raw SID, PID, path, ACL or rule details go to public GitHub logs/artifacts. Evidence identity must be distinguished from authenticity and authority.

The record's defaults must be admission BLOCKED, localExecute false, authority NONE until a separate reviewed mechanism is implemented and accepted. This PR does not implement the positive admission path or authorize key provisioning, service changes, process launch or a network probe.

## Read-only predicates and applicability

|Predicate|required evidence|Existing ADMINIT feasibility without changing state|Current result|
|---|---|---|---|
|Trusted source delivery|Independent approved HEAD/tree, full fixed package inventory, regular file modes, file/volume identities, bytes and no reparse/hardlink substitutions|Reading source and metadata is feasible; v1 collector does not do it; same-user replaceability remains|UNPROVEN|
|Filesystem boundary|Actual test token effective access to declared lab and denied protected projects/data/services; inherited DACLs/owner, restricted SIDs, privileges, mandatory labels, all ancestors and object types considered|ACL enumeration is feasible; ACL grant counts and owner whitelist are insufficient. Current same-user access cannot be removed by reading|UNPROVEN|
|Token boundary|Actual observer/test process tokens: elevation type, integrity, enabled/deny-only/restricted groups, AppContainer/capabilities if applicable, privileges and broker/child behavior|Read-only token queries are feasible in principle; fixed whoami CSV+IsInRole is only a narrow observation|UNPROVEN|
|Network egress boundary|Effective policy for exact token/application/compartment, enabled profiles, routing/interfaces, address/port/application/service conditions, overrides/IPsec/WFP providers and authenticated enforcement scope|ActiveStore inventory can be read when permitted; profile-matching counts do not prove deny enforcement|UNPROVEN|
|Loopback/protected PostgreSQL|Explicit effective denial covering IPv4/IPv6 loopback and local IPC (including named-pipe/shared-memory/service access where applicable), for exact test identity|No PostgreSQL connection, port probe, service inspection or DB command is authorized here; no such guarantee in v1 snapshot|UNPROVEN|
|Observer independence|Collector policy, signing keys and protected evidence storage beyond candidate/same-user control, independently enrolled|The same administrative account and repository cannot establish this themselves; hashes do not solve it|UNPROVEN|
|Stable enforcement|Accepted existing OS/VM/container boundary with predicates valid throughout bounded test; fail-closed handling of drift/unreadable state|A read-only poller cannot impose missing enforcement; no existing independent mechanism has been evidenced|UNPROVEN|

The statement that the entire PC is a test environment changes intended asset scope but does not eliminate the explicit exclusions for PostgreSQL, historical labs and other projects. We have no read-only measurement of their effective protection. No assumption of a separate account, sandbox or WFP policy is made.

## Continuous observation versus enforcement

A future bounded observer could read a baseline, independently pin source/object/token/policy identities, then sample with monotonic sequence numbers and deadlines. It must reject missing/out-of-order/stale samples, backwards clocks, ACL/owner/inheritance changes, rule/default-profile/route/WFP changes, source replacement, token drift and watcher failure. Identical counts are not identical ACL/rule sets. The private evidence must contain full canonical records or independently established protected fingerprints, not a producer's unchecked booleans.

Polling has an unavoidable blind interval: a same-user adversary can modify and restore state between samples, change the observer, replace source or forge local evidence. Hashes/signatures with same-user keys do not repair that boundary. Read-only file opens/notifications also do not prove an unchanged effective policy for the complete interval. File sharing locks can affect writers and are not silently introduced as a 'read-only' improvement here.

Therefore continuous sampling may detect some changes but cannot independently satisfy continuous isolation. An accepted enforcement boundary must already exist and be independently measurable; if not, admission stays BLOCKED. Any future abort/Job Object termination integration requires separate review and launch authorization; no monitor or native test is started by this PR.

## Administrative account and TOCTOU

Medium integrity with Administrators deny-only is not a restricted-user sandbox. It does not revoke ownership/read/write access granted to the same account, isolate local services, protect observer keys from that user, or prevent policy changes by another elevated process. UAC consent and possible linked tokens need consideration; enabled admin role is rejected, but role absence alone is not proof of confinement. No UAC, ExecutionPolicy, account, firewall or ACL change is proposed for automatic application.

## Future state sequence

DRAFT -> independently measured prerequisites -> independent review -> explicit scoped approval -> bounded synthetic launch. Each arrow requires separate evidence; none is implemented by g0.mjs. Drift/unreadable state leads to BLOCKED, never automatic retry/unlock. Full native G1 and Q01 acceptance remain separate from G0 observations.
