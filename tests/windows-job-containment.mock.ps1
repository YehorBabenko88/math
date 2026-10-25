# Compilation and fake calls only. Never construct WindowsJobKernel here.
$ErrorActionPreference = 'Stop'
$source = Get-Content (Join-Path $PSScriptRoot '../scripts/q01-lab/WindowsJobContainment.cs') -Raw
$fixture = @'
namespace MathUniverse.Q01 {
 public sealed class FakeKernel : IJobKernel {
  public System.Collections.Generic.List<string> Calls=new System.Collections.Generic.List<string>();
  public string Fail; public uint WaitResult; public int Waits;
  void Step(string s) { Calls.Add(s); if(Fail==s) throw new System.Exception(s); }
  public System.IntPtr CreateJob() { Step("job"); return (System.IntPtr)1; }
  public void ConfigureKillOnClose(System.IntPtr j) { Step("limits"); }
  public void CreateSuspended(string e,string[] a,string d,out System.IntPtr p,out System.IntPtr t) { Step("suspend"); p=(System.IntPtr)2;t=(System.IntPtr)3; }
  public void Assign(System.IntPtr j,System.IntPtr p) { Step("assign"); }
  public void Resume(System.IntPtr t) { Step("resume"); }
  public uint Wait(System.IntPtr p,uint ms) { Step("wait"); return ++Waits==1?WaitResult:0; }
  public uint ExitCode(System.IntPtr p) { Step("exit"); return 7; }
  public bool WaitJobEmpty(System.IntPtr j,uint ms) { Step("drain"); return Fail!="drain-timeout"; }
  public void TerminateJob(System.IntPtr j) { Step("kill-job"); }
  public void TerminateProcess(System.IntPtr p) { Step("kill-process"); }
  public void Close(System.IntPtr h) { Step("close-"+h); }
 }
 public static class MockAcceptance {
  static string Run(string fail,uint wait) {
   var f=new FakeKernel { Fail=fail,WaitResult=wait };
   try { Containment.RunOwned(f,"fixture.exe",new string[0],"fixture",1000); }
   catch(System.Exception) { if(fail==null && wait==0) throw; }
   return string.Join(",",f.Calls.ToArray());
  }
  static void Expect(string actual,string expected) { if(actual!=expected) throw new System.Exception(actual+" != "+expected); }
  public static void Verify() {
   Expect(Run(null,0),"job,limits,suspend,assign,resume,wait,exit,kill-job,drain,close-3,close-2,close-1");
   Expect(Run("assign",0),"job,limits,suspend,assign,kill-process,wait,close-3,close-2,close-1");
   Expect(Run("drain",0),"job,limits,suspend,assign,resume,wait,exit,kill-job,drain,close-3,close-2,close-1");
   Expect(Run("drain-timeout",0),"job,limits,suspend,assign,resume,wait,exit,kill-job,drain,close-3,close-2,close-1");
   var undrained=new FakeKernel { Fail="drain-timeout" };
   bool blocked=false;
   try { Containment.RunOwned(undrained,"fixture.exe",new string[0],"fixture",1000); }
   catch(System.InvalidOperationException e) { blocked=e.Message=="job drain unconfirmed: BLOCKED"; }
   if(!blocked) throw new System.Exception("undrained job accepted");
   Expect(Run("limits",0),"job,limits,close-1");
   Expect(Run("suspend",0),"job,limits,suspend,close-1");
   Expect(Run("resume",0),"job,limits,suspend,assign,resume,kill-job,drain,kill-process,wait,close-3,close-2,close-1");
   Expect(Run(null,258),"job,limits,suspend,assign,resume,wait,kill-job,drain,kill-process,wait,close-3,close-2,close-1");
   Expect(Run("kill-job",0),"job,limits,suspend,assign,resume,wait,exit,kill-job,close-3,close-2,close-1");
  }
 }
}
'@
Add-Type -TypeDefinition ($source + $fixture)
[MathUniverse.Q01.MockAcceptance]::Verify()
Write-Output 'PASS: compilation and ten mock sequencing/cleanup cases; zero native calls'

