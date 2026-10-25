# PR51 GPT4/5/6 integration acceptance

Baseline PR51 `878c178bcf6d068f552f4c642820f42cad9a43a9`, tree `13b14e26570299c195afc8873d39704335848241`. New branch `integration/pr51-gpt456-qualification`. Tested implementation `02c7b1bc58baadd63213f92ba450ce724638a286`, tree `179c1660966381e63c0727bdf42ec922414b698a`. Final delivery commit adds only this report and metadata; its exact HEAD/tree are supplied by GitHub commit/PR metadata and the delivery response (a report cannot embed its own commit hash).

## Exact source identity and disposition

| PR | HEAD | Tree | Integration |
|---|---|---|---|
|52|`ca5aa89fe3f04f1f43945d113d56a73a6a78939b`|`9572455fa881a1507ca93f9ec6aa9e9f425cb7d9`|History-preserving merge5e00bc6; six additional evidence mutations in one test |
|53|`d9310dc3136dbae81497da608e72f053be97365f`|`f404609a05193607467d97e2440a30f9072cc85a`|History-preserving mergea403155 plus confirmed integration fixes |
|54|`a581d978fb8e5560f941cca9ad205d67311efac0`|`3e217934d1d0d540521f1669169be4b94e98d7fc`|Narrow port1196291; old PR44 base deliberately not merged |
|55|`6287ccf53cfbcf419a340ec47f871eef6515c730`|`63196902ee8b103c272df449735c7fbe9b5de29c`|History-preserving mergea46794f plus broader runtime withholding |

All heads refreshed through read-only GitHub APIs and compared to the objects integrated. Source52/53/55 are ancestors;54 is a documented narrow port, not a claim of merged ancestry. PR48/50/51 and all four source branches/PRs unchanged. No main merge. Workflow overlap auto-merged without textual conflict; meaning was reviewed manually:54 root-cleanup confirmation,55 raw-output withholding and51 owner-expiry proof all retained.

## Confirmed findings and RED/GREEN

- **P1 privacy/publication:** original native report contained SID/ACL/process identities and was echoed to stdout; workflow uploaded raw reports/bootstrap streams. PR55 tests fail before integration and pass after. Fixed status line replaces raw console output; public ADMINIT uploads now only package/source/digest metadata. Raw names and private inventory are withheld. This is forward-only; historical Git/artifacts are not erased.
- **P2 PowerShell watchdog:** original timeout discarded the5000ms wait result. Independently exercised the actual workflow timeout branch using a fake owner (no child processes): false wait, false HasExited, kill exception and confirmed root exit. Baseline RED, narrow fix GREEN. Every timeout remains BLOCKED; root exit never proves descendant drain. Forced owner-watchdog implementation stays unchanged except PR55 fixed stdout line.
- **P2 PR53 syntax regression:** literal backslash-n sequences collapsed the strict helper into a comment and caused `Unexpected token '}'`. Exact imported source fails `node --check`; dedicated subprocess syntax regression RED then GREEN after replacing only those formatting escapes.
- **P2 typed ZIP metadata:** RegExp coercion accepted array OIDs/digests and numeric IDs despite the metadata contract. Negative tests RED, strict string checks GREEN. ZIP admission remains UNATTESTED_METADATA, extraction/execution DENIED. Names-only policy is not a ZIP parser and proves no archive safety.
- **P2 Windows test compatibility:** PR53 used URL.pathname for a Node CLI path, producing exit1 instead of intended exit2 on Windows. Preserved failing evidence, corrected to fileURLToPath, GREEN. Mandatory external tree is forwarded in the PowerShell mock; qualified CLI rejects omission. Legacy library verification without tree stays unqualified, never Execute.
- **P2 additional raw PID surfaces:** Q01 worker-ready timeline contains real PID and legacy hosted-native uploaded raw process reports. New negatives RED then digest-only public receipts GREEN. Existing full local Q01 verification remains before projection. Original hosted-only fixture source/helper, SQLite production queue and historical SQL files are unchanged.
- **Test-coverage gap:** independent review noticed omitted new package/ZIP/syntax/caller tests in the explicit hosted command. Added these, privacy/receipt tests, PS5.1 workflow parser and watchdog mocks with native exit-code checks. No assertions removed or weakened.

Two independent read-only subagent reviews reported no remaining P1/P2 in their inspected package/ZIP/combined-workflow and receipt scopes. This is code/model review, NOT independent native or full-repository acceptance.

## Matrix

| Layer | Result |
|---|---|
|Local Windows Node22.23.3,51 selected pure/static/model files|396 PASS /0 FAIL /5 SKIP,401 tests|
|Local Windows Node24.20.0, same inventory|396 PASS /0 FAIL /5 SKIP,401 tests|
|Windows PowerShell5.1 parser|10 workflow blocks PASS; no block executed|
|PowerShell7 parser|10 workflow blocks PASS; no block executed|
|PowerShell5.1 fixture compile + pure wait classification|5 PASS; Main not invoked; zero native calls|
|PS5.1 actual timeout-branch mock|4 PASS; fake owner only|
|Existing containment mock|23 sequencing/cleanup traces PASS; zero native calls|
|Execute/parser mock|PASS, unconditional refusal before filesystem/native effects|
|SQL checkout / dependency policy / diff check|PASS; all11 historical SQL files unchanged|
|Source PR51 CI snapshot|36 QUEUED runs|
|Source PR52/53/54/55 snapshot|15 QUEUED runs each|
|Fresh hosted runtime/ZIP/private native acceptance|NOT_RUN/BLOCKED, no success inferred from QUEUED|
|ADMINIT native/Q01/PostgreSQL execution|NOT_RUN; no physical command performed|
|Effective isolation / PhysicalG1 / Production|BLOCKED / BLOCKED / NO-GO|

Five skips are denied symlink/POSIX fixture limitations, explicitly not PASS. The51-file inventory is bounded and not a full unfiltered PostgreSQL/PDF/Browser suite. No PostgreSQL server/client, native EXE, physical machine connection, deployment or service operation was run. No rerun/dispatch/cancellation requested; automatic CI for the new source candidate must be assessed separately.

[Source API/CI inventory](pr51-gpt456/source-heads-ci.json) records exact run IDs, events, source, attempt and conclusions plus private metadata hashes. [Local evidence manifest](pr51-gpt456/local-evidence-sha256.json) includes RED, GREEN and the intermediate failed Windows CLI test explicitly labelled FAIL, not falsely reported GREEN. Raw logs retained privately; SHA256 establishes byte identity only.

## Privacy and closed evidence channel

[Private channel design](PRIVATE_NATIVE_EVIDENCE_CHANNEL_DESIGN.md): no receiver/trust anchors/keys/transport are configured or accepted. Current raw evidence stays only on ephemeral runners. After destruction it cannot be recovered from a public digest; any such run stays independently unqualified. Public receipts are producer commitments, not attestations. The native validator explicitly reports PRODUCER_LOCAL_SCHEMA_ONLY and independentAcceptance=BLOCKED_PRIVATE_EVIDENCE_REQUIRED; local schema PASS is not native acceptance.

Public native stdout/artifact configuration no longer includes raw SID/PID/ACL/process records. All runtime/binary/exception surfaces still require private review; this is not a blanket privacy certificate. Original source PR workflows are intentionally unchanged and may still publish their old raw configuration if queued runs execute. This branch cannot retroactively redact history or safely substitute evidence. Any cancellation/retention decision is separate operator work.

[Current verify-only packet](PR51_CURRENT_VERIFY_ONLY_PACKET.md) supplies mandatory external tree and the separate new acceptance root. It supersedes obsolete examples without editing historical snapshots and is not permission to run it. Isolation evaluator and Execute remain fail-closed. Effective filesystem/network/loopback isolation, private evidence review and explicit physical admission are still required.

## GO / NO-GO

GO for independent code review of this candidate only. Hosted native acceptance BLOCKED until an authenticated confidential evidence channel and independent review are implemented and accepted. Bootstrap/PowerShell forced native expiry and zero descendants remain unproved; four PS mock cases do not prove OS lifecycle behavior. ZIP byte parsing/digest/source/run/attempt/job binding remains blocked without actual artifacts. Q01 forensic closure is not inferred from synthetic/model checks or receipts.

Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book gate CLOSED. Next safe step: independent review of this exact candidate and channel design, then inspect original queued CI without reruns. No physical command packet is authorized by this report.
