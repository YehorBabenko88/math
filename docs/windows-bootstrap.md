# Automatic prerequisites on a standalone Windows PC

Run elevated PowerShell. The installer checks Git, Node.js 22/24, NSSM and optional PostgreSQL detection. It installs missing required packages using Windows Package Manager (winget) **only after** explicit `-AcceptPackages`. Package IDs and availability depend on the configured winget source; review the IDs and the resulting install before using this on the target host.

```powershell
git clone -b feat/math-universe-foundation https://github.com/YehorBabenko88/math.git C:\MathUniverseSetup
Set-ExecutionPolicy -Scope Process Bypass
& C:\MathUniverseSetup\scripts\windows-bootstrap.ps1 -AcceptPackages
```

To install the service as a separate supervised step, run:
```powershell
& C:\MathUniverseSetup\scripts\windows-bootstrap.ps1 -AcceptPackages -InstallService
```

This script does not install PostgreSQL, does not access Grid, and does not register the 15-minute updater task. A Windows administrator must supervise the first service install and test the rollback. If winget is absent or package installation fails, it stops with an error rather than silently downloading binaries from arbitrary URLs.

For computers without Git, obtain the installer script through the GitHub web interface or a trusted archive of this repository. Do not run a remote PowerShell script directly from an unverified URL.

**Pilot limitations:** NSSM package ID availability and PATH registration have not been tested on the target PC. The deployment updater still requires a dedicated low-privilege service identity, better verification of CI run origin, and a real Windows rollback drill before unattended updates are enabled.
