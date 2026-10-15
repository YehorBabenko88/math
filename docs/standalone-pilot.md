# Independent Windows pilot (no Grid connectivity)

Math Universe is a standalone scientific application on a dedicated Windows PC. No Cluster Grid integration, Tailscale routing, shared database, remote SSH, or trading services during the pilot.

## Release gates
1. Pin the approved GitHub branch and exact commit.
2. Require Validate Math Universe and Browser E2E to succeed for that exact SHA.
3. Run local Node tests before activation.
4. Activate immutable release; health-check loopback HTTP server; rollback on failure.
5. Keep automatic updates **disabled until** a supervised install and rollback drill succeed.
6. Record installed SHA, Node version, update attempts, and local test outcomes.

## Pilot acceptance criteria
- Local UI opens at http://127.0.0.1:8787; /healthz returns status ok.
- Reboot restores the service without manual login.
- Scientific sample graphs execute and export/import without data loss.
- SI and numeric scientific validation reject incompatible units and invalid evidence.
- Provider APIs tested only with authorized credentials and rate limits.
- Unavailable network does not delete scientific data or interrupt local graph operations.
- Failed update leaves previous known-good release available and restarts it.
- No listener binds to public/LAN interfaces; no outbound Grid connections.
- Browser download tests are run on the actual Windows host and their failures documented.

## PostgreSQL decision
The current foundation stores graph data in browser export/import and runs Node modules; there is no production persistence API yet. Do not create tables or grant DB access merely because PostgreSQL is installed. A later persistence implementation should use a separate database and restricted role, explicit migrations, backup/restore tests, and bounded read/write APIs. Never reuse Cluster Grid credentials.

## Future compatibility contract
Design a versioned, read-only export of scientific works, evidence, formulas and experiment provenance. No direct database-to-database access. A later Grid integration should consume a versioned HTTP/JSON or signed file exchange contract, and require a separate security review.

## Deployment status
GitHub CI does not validate the Windows NSSM installer. Installation and rollback scripts must be manually reviewed and tested on the target host before unattended activation.
