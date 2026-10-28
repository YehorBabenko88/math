# GPT-1 independent admission review of PR #83

Source: PR #83 HEAD `a7113b3f0ae18d21948f0a71db26ea3ab9636b7e`, tree `9a3a5a60e58c802f26d55763da45b027f1292c3f`.
PR #82 control HEAD `26e4651bf39312b7e2169dab0e4d72f717d53aee`, tree `ddce920f465dde2ec2eb9a06fbaa45ff50c999b7`.

## Independent findings

**P1 / ADMISSION BLOCKER (unproven custody, not demonstrated exploitation):**
Git blob identity, detached checkout, no-reparse checks, and a Medium Integrity
administrator session do not prevent a same-user actor from replacing the
checkout, wrapper, compiler input, or observer between checks and execution.
The dossier already acknowledges this limitation and explicitly refuses to
authorize Gate B. Do not represent Gate A as independent observer custody.
A future physical procedure must independently bind the approved immutable
source bytes and actual launched observer, preserve custody across the launch,
and fail closed on drift; same-account self-reported hashes do not suffice.
No new physical step is authorized by this report.

**P1 / CI acceptance blocker:** PR #83 exact-head Validate Math Universe
run 40499253559 FAILED at mandatory PostgreSQL CI coverage contract.
Windows Deployment Contracts run 40499253678 FAILED in the pwsh
fixture-preparation step with HTTP 404 from the Pester dependency endpoint.
PostgreSQL Integration run 40499253809 FAILED in four matrix jobs;
the DB server log contains expected-looking negative-path errors, which
alone do not establish the test failure cause. The coverage job also failed.
Do not count these as token/physical acceptance PASS.

**P2 / protocol and privacy:** The dossier correctly prohibits inventing
Q/T stages for historical v1 E_QUERY, forbids v1/v2 mixed fields, and limits
public projection to the normalized allowlist. Its private stdout custody,
independent host identity and exact observer execution are not demonstrated
by this documentation-only PR. No executable admission or Execute authority
was added in PR #83.

## Negative acceptance fixtures for future independent qualification

1. After source hash verification, replace a wrapper with a same-user file
   of the same length and mtime but different bytes. Must BLOCK before
   observer launch; host-local hash alone is not an independent witness.
2. Replace a verified child-process executable between path inspection and
   process creation. Require independently bound launched image identity,
   otherwise BLOCK.
3. Use a v1 result with v2 diagnostic fields, and a v2 result missing either
   field. Both must BLOCK without exposing rejected bytes.
4. Supply two JSON records, nonempty stderr, or wrong producer/validator exit.
   Must BLOCK without retry and without public raw output.
5. Return a synthetic token PASS while a cleanup/CloseHandle failure is
   injected. Final status must be UNKNOWN, admission BLOCKED.
6. Use an elevated/admin-enabled or impersonating child after a Medium parent
   precheck. Must BLOCK; parent-only evidence is insufficient.

These are acceptance requirements, **not executed test results**. No native
Token API, physical ADMINIT, G1, PostgreSQL, or Q01 stress was run here.

## Decision

Gate A documentation review: PARTIAL, custody UNPROVEN.
One new read-only physical G0: **NOT_AUTHORIZED / NO-GO** until independent
custody, completed scoped evidence and fresh explicit operator approval.
Q01 OPEN. Production NO-GO. No merge or deployment.

## Exact-head hosted follow-up

For audit HEAD `bace92991d573d798c0a52a3cc64311cc42b3090`,
the later observed hosted status is: Book Ingestion SUCCESS, Browser E2E
SUCCESS, Q01 Windows Containment Preparation SUCCESS, Windows Deployment
Contracts SUCCESS; Validate Math Universe FAILURE; Q01 Queue Reliability
IN_PROGRESS and PostgreSQL Integration IN_PROGRESS. These are separate
from the earlier PR83 exact-head runs and do not supersede their failure
receipts. No physical G0 acceptance follows from any of these CI outcomes.

The dossier's Gate A remains a design and document review only. Source
and observer custody must be attested independently of the same-user
checkout, with an explicit launch-time identity binding. Any inability to
obtain that evidence remains BLOCKED, not a reason to weaken a guard.
