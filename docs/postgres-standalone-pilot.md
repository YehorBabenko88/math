# Standalone PostgreSQL pilot (Windows)

**Status:** opt-in pilot only. Nothing here installs a service or changes databases automatically.

1. Create a **new dedicated** PostgreSQL database and dedicated role. Never use Cluster Grid's database or PostgreSQL superuser for the running service.
2. Install Node.js 22 or 24, then in a local clone run `npm install pg`. Commit a reviewed lockfile before reproducible production deployment; do not run unattended installs from a moving branch.
3. Set `MATH_UNIVERSE_DATABASE_URL` in the **service account's** environment (not in Git, logs, or PowerShell history). Set `MATH_UNIVERSE_WORKER_ID` and optionally `MATH_UNIVERSE_CONCURRENCY=1`.
4. Apply migrations **manually** with a dedicated migration role and a reviewed backup. Example Node REPL:
   ```js
   const {Pool}=await import('pg');
   const {applyMathMigrations}=await import('./src/postgres-migrations.mjs');
   const pool=new Pool({connectionString:process.env.MATH_UNIVERSE_DATABASE_URL});
   try { console.log(await applyMathMigrations(pool)); } finally { await pool.end(); }
   ```
5. Only after reviewing handler registrations, launch `node src/ingestion-service.mjs`. The default handler map is empty, so queued scientific work cannot be processed until explicit handlers are wired.
6. Validate queue claims, heartbeat renewal, recovery, and shutdown against the dedicated test database. Keep automatic deployment disabled until a Windows service restart and rollback drill has passed.

**Security:** run under a restricted local Windows account; grant the runtime role only required DML permissions. Never run the Node process as LocalSystem. Restrict database access to localhost/Tailscale as appropriate. The service is not yet packaged or qualified for unattended use.
