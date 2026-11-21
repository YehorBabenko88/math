# ADMINIT read-only isolation review packet — NOT execution admission

Do not run the native harness, Q01, a PostgreSQL client or any connectivity probe. These proposed read-only commands are for a separately reviewed future preflight; they were NOT run on ADMINIT by Codex. Do not create or modify historical MathUniverseLab, ACLs, services, firewall, UAC or execution policies. Keep raw SID/path/rule output private. No textual result or environment flag opens Execute.

## Exact observations

In the existing unelevated PowerShell5.1 session, individually inspect:

```powershell
whoami /all
$PSVersionTable
Get-ExecutionPolicy -List
[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
```

Review token Integrity RID8192 and Administrators DENY_ONLY, rather than mere group membership. Record RemoteSigned as the current observed value; reported Restricted is historical and its change cause UNKNOWN. No policy changes.

For the proposed new acceptance root only (do not create it yet):

```powershell
$acceptanceRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MathUniverseAdminitAcceptance'
Test-Path -LiteralPath $acceptanceRoot
if (Test-Path -LiteralPath $acceptanceRoot) {
  Get-Item -LiteralPath $acceptanceRoot -Force | Select-Object Attributes,LinkType
  Get-Acl -LiteralPath $acceptanceRoot | Format-List Owner,AccessToString,Sddl
}
Get-Acl -LiteralPath ([Environment]::GetFolderPath('LocalApplicationData')) | Format-List Owner,AccessToString
```

Absence is UNKNOWN, not permission to create or execute. Review every existing ancestor for reparse points, owner and effective write rights; this snapshot cannot prevent later path/ACL changes and cannot establish an access boundary to other projects. Do not enumerate their files or change their permissions.

Network policy inventory (no traffic generated, no database access):

```powershell
Get-NetFirewallProfile -PolicyStore ActiveStore | Select-Object Name,Enabled,DefaultInboundAction,DefaultOutboundAction
Get-NetFirewallRule -PolicyStore ActiveStore -Enabled True | Select-Object Name,Direction,Action,Profile,PolicyStoreSourceType
Get-NetTCPConnection -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
Get-Service -Name 'postgresql*' | Select-Object Name,Status,StartType
```

Permission/cmdlet failures are BLOCKED/UNKNOWN; never retry elevated. These observations do not establish effective isolation. Independent review must correlate applicable rule application/service, address and port filters, token identity, WFP/loopback treatment, filesystem effective permissions and policy continuity. An enabled firewall, lack of current outbound connections or whole-PC test designation does not prove a deny boundary. Existing PostgreSQL18 must remain untouched. No Test-NetConnection, SQL connection, service control or configuration write.

The existing `collect-isolation.ps1` is a partial read-only stdout collector; it does not invoke Git and is not the tracked-document publication checker. Its machineName/userSid output is private. Its evaluator deliberately returns isolationConfirmed=false, localExecute=false and BLOCKED even when observations individually pass. Snapshot source identity is UNKNOWN pending separate qualified delivery verification. There is no unlock flag.

## Admission remains closed

Require independent effective filesystem/network/loopback isolation acceptance, exact qualified package/source delivery, completed hosted native evidence and a separate explicit physical admission. The commands above provide observations only. Historical laboratories and current PostgreSQL are protected, even though the entire machine is designated a test environment.
