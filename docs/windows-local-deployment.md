# Math Universe on Windows (local-only)
The project is currently a static browser UI and Node modules; PostgreSQL is **not required** to serve it. Do not create a database until persistent scientific jobs, indexing, or accounts are implemented.

## Prerequisites
Install Git, Node.js 22/24, NSSM; run PowerShell as Administrator. Ensure `git`, `node`, `nssm` are on PATH. Run this only on a trusted machine.

## First installation
```powershell
git clone -b feat/math-universe-foundation https://github.com/YehorBabenko88/math.git C:\MathUniverseSource
Set-ExecutionPolicy -Scope Process Bypass
& C:\MathUniverseSource\scripts\windows-update.ps1 -Install
```
Open http://127.0.0.1:8787. Health endpoint: http://127.0.0.1:8787/healthz. The service is named `MathUniverse` and uses NSSM to restart after crashes.

## Background updates every 15 minutes
Copy the updater script to a **fixed path outside the Git worktree** (e.g. `C:\ProgramData\MathUniverse\windows-update.ps1`) and register a task in an elevated PowerShell:
```powershell
Copy-Item C:\MathUniverseSource\scripts\windows-update.ps1 C:\ProgramData\MathUniverse\windows-update.ps1
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "C:\ProgramData\MathUniverse\windows-update.ps1"'
$trigger=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName 'MathUniverse-Update' -Action $action -Trigger $trigger -User 'SYSTEM' -RunLevel Highest
```
Updater fetches a specific branch, verifies both required GitHub Actions succeeded on its **exact commit SHA**, creates an isolated git worktree release, runs Node unit tests, switches active release, restarts service and rolls back active pointer if local health check fails. No force pushes, DB migrations, or automatic merges.

**Security:** This is an opt-in automatic deployment mechanism. Only use with a protected, trusted deployment branch. A green CI result is not a substitute for code review. GitHub API unauthenticated rate limits may interrupt polling; failure must leave the current release intact. Prefer dedicated release tags and signed provenance before production deployment.

**Known limitations:** The updater has not yet been tested on the target Windows host; first run must be supervised. Its health endpoint proves the HTTP server is reachable, not that every scientific subsystem works. Scheduled updater script is deliberately kept outside releases, so its own updates require an explicit administrator action. Running as SYSTEM is convenient but overprivileged; switch to a dedicated low-privilege service account before production use. Port 8787 binds to loopback only, so no LAN/Tailscale exposure by default. For future PostgreSQL persistence use a separate restricted role, local TCP/Unix socket, migrations with backups, and no database credentials in Git.
