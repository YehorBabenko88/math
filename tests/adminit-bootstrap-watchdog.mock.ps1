param([string]$EvidencePath)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$launcher=[IO.File]::ReadAllText((Join-Path $root 'tests/fixtures/adminit-containment/HostedMediumLauncher.cs'))
$start=$launcher.IndexOf('    Check(k.Wait(p,120000)')
$end=$launcher.LastIndexOf("`n  }")
if($start -lt 0 -or $end -le $start){throw 'Production deadline/catch/finally fragment missing'}
$fragment=$launcher.Substring($start,$end-$start)
# Compile the actual post-launch fragment with fake setup and fake kernel only.
$source=@'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class BootstrapDeadlineMock {
 public static List<string> Calls=new List<string>();
 public static uint WaitResult; public static bool Drain,KillFails,CloseFails,Assigned;
 static void Check(bool ok,string why){if(!ok)throw new InvalidOperationException(why);}
 static bool CloseHandle(IntPtr h){Calls.Add("close:"+h.ToInt32());return !(CloseFails&&h.ToInt32()==1);}
 static IntPtr LocalFree(IntPtr h){throw new Exception("unexpected LocalFree");}
 class FakeKernel {
  public uint Wait(IntPtr p,uint ms){Calls.Add("wait:"+ms);return WaitResult;}
  public uint ExitCode(IntPtr p){Calls.Add("exit");return 0;}
  public void TerminateJob(IntPtr j){Calls.Add("kill-job");if(KillFails)throw new Exception("mock kill failed");}
  public bool WaitJobEmpty(IntPtr j,uint ms){Calls.Add("drain:"+ms);return Drain;}
  public void TerminateProcess(IntPtr p){Calls.Add("kill-process");if(KillFails)throw new Exception("mock kill failed");}
 }
 public static int Run(){
  IntPtr p=new IntPtr(1),t=new IntPtr(2),job=new IntPtr(3),token=new IntPtr(4),limited=new IntPtr(5),sid=IntPtr.Zero,label=IntPtr.Zero,env=IntPtr.Zero;
  bool assigned=Assigned;var k=new FakeKernel();int result=2;
  try {
'@
$source+=$fragment+"`n }`n}"
if($source -match 'DllImport|WindowsJobKernel|public static int Main'){throw 'Native boundary present in mock compilation'}
Add-Type -TypeDefinition $source
$cases=@(
 @{name='timeout';wait=[uint32]258;assigned=$true;drain=$true;kill=$false;close=$false;reason='';code=2},
 @{name='WAIT_FAILED';wait=[uint32]::MaxValue;assigned=$true;drain=$true;kill=$false;close=$false;reason='';code=2},
 @{name='timeout drain failed';wait=[uint32]258;assigned=$true;drain=$false;kill=$false;close=$false;reason='descendant drain unconfirmed'},
 @{name='root signalled descendant drain';wait=[uint32]0;assigned=$true;drain=$true;kill=$false;close=$false;reason='';code=0},
 @{name='root signalled descendant survives';wait=[uint32]0;assigned=$true;drain=$false;kill=$false;close=$false;reason='descendant drain unconfirmed'},
 @{name='job kill failed';wait=[uint32]258;assigned=$true;drain=$true;kill=$true;close=$false;reason='mock kill failed'},
 @{name='close failed';wait=[uint32]258;assigned=$true;drain=$true;kill=$false;close=$true;reason='owned handle close failed'},
 @{name='unassigned cleanup confirmed';wait=[uint32]0;assigned=$false;drain=$true;kill=$false;close=$false;reason='';code=0},
 @{name='unassigned cleanup unconfirmed';wait=[uint32]258;assigned=$false;drain=$true;kill=$false;close=$false;reason='unassigned supervisor cleanup unconfirmed'}
)
$evidence=@()
foreach($case in $cases){
 [BootstrapDeadlineMock]::Calls.Clear()
 [BootstrapDeadlineMock]::WaitResult=$case.wait
 [BootstrapDeadlineMock]::Assigned=$case.assigned
 [BootstrapDeadlineMock]::Drain=$case.drain
 [BootstrapDeadlineMock]::KillFails=$case.kill
 [BootstrapDeadlineMock]::CloseFails=$case.close
 $reason='';$code=$null
 try{$code=[BootstrapDeadlineMock]::Run()}catch{$reason=$_.Exception.GetBaseException().Message}
 $calls=@([BootstrapDeadlineMock]::Calls)
 if($calls[0] -ne 'wait:120000'){throw ('Wrong deadline: '+$case.name)}
 if($case.reason){if(-not $reason.Contains($case.reason)){throw ('Wrong failure: '+$case.name)}}
 elseif($reason -or $code -ne $case.code){throw ('Wrong exit: '+$case.name)}
 if((($calls|Where-Object {$_ -like 'close:*'}) -join ',') -ne 'close:1,close:2,close:3,close:4,close:5'){throw ('Owned handles not all closed exactly once: '+$case.name)}
 if($case.wait -ne 0 -and $calls -contains 'exit'){throw ('Failed wait read exit code: '+$case.name)}
 $expectedKill=if($case.assigned){'kill-job'}else{'kill-process'}
 if($calls -notcontains $expectedKill){throw ('Missing kill: '+$case.name)}
 if($case.assigned -and -not $case.kill -and $calls -notcontains 'drain:5000'){throw ('Missing descendant drain: '+$case.name)}
 if(-not $case.assigned -and $calls -notcontains 'wait:5000'){throw ('Missing unassigned wait: '+$case.name)}
 if($calls.IndexOf($expectedKill) -gt $calls.IndexOf('close:1')){throw ('Close preceded cleanup: '+$case.name)}
 $evidence+=@{name=$case.name;calls=$calls;exitCode=$code;expectedFailure=$case.reason}
}
& (Join-Path $PSScriptRoot 'adminit-powershell-watchdog.mock.ps1')
$result=@{qualification='MODEL/source-fragment mocks only; setup and kernel are fake';nativeExpiryHosted='BLOCKED';nativeCalls=0;bootstrapDeadlineMs=120000;powershellDeadlineMs=150000;launcherSha256=([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($launcher))).Replace('-',''));bootstrapCases=$evidence;powerShellCases=4;limitations='Does not qualify native timing, process creation, token setup, job semantics or hosted execution. Existing owner watchdog and cleanup guards unchanged.'}|ConvertTo-Json -Depth 8
if($EvidencePath){
 $bytes=[Text.Encoding]::UTF8.GetBytes($result)
 $stream=[IO.File]::Open($EvidencePath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
}
Write-Output 'PASS: 9 bootstrap source-fragment mock cases; native/hosted expiry remains BLOCKED; zero native calls'
