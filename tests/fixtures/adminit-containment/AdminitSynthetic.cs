namespace MathUniverse.Adminit {
 using System;
 using System.IO;
 using System.Collections.Generic;
 using System.Diagnostics;
 using System.Reflection;
 using System.Runtime.InteropServices;
 using System.Security.Principal;
 using System.Threading;
 using System.Web.Script.Serialization;
 using MathUniverse.Q01;
 public static class Synthetic {
  static readonly JavaScriptSerializer Json=new JavaScriptSerializer();
  static readonly string Self=Assembly.GetExecutingAssembly().Location;
  static string Suite;
  static object TokenEvidence;
  static readonly List<object> Evidence=new List<object>();
  [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr h,uint ms);
  [DllImport("kernel32.dll",SetLastError=true)] static extern uint GetProcessId(IntPtr h);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr h,out long created,out long exited,out long kernel,out long user);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsProcessInJob(IntPtr p,IntPtr j,out bool member);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr h);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr p,uint access,out IntPtr token);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr data,uint size,out uint required);
  [DllImport("advapi32.dll")] static extern IntPtr GetSidSubAuthorityCount(IntPtr sid);
  [DllImport("advapi32.dll")] static extern IntPtr GetSidSubAuthority(IntPtr sid,uint index);
  static void Check(bool ok,string why){if(!ok)throw new InvalidOperationException(why);}
  static void CloseAll(params IntPtr[] handles){bool ok=true;foreach(IntPtr h in handles)if(h!=IntPtr.Zero)ok=CloseHandle(h)&&ok;Check(ok,"owned handle close failed");}
  public static void AssertMedium(){
   IntPtr token;Check(OpenProcessToken(GetCurrentProcess(),8,out token),"token query BLOCKED");
   IntPtr data=Marshal.AllocHGlobal(256);
   try{uint n;Check(GetTokenInformation(token,20,data,256,out n),"elevation query BLOCKED");int elevation=Marshal.ReadInt32(data);Check(elevation==0,"elevated token BLOCKED");
    Check(GetTokenInformation(token,25,data,256,out n),"integrity query BLOCKED");IntPtr sid=Marshal.ReadIntPtr(data);byte count=Marshal.ReadByte(GetSidSubAuthorityCount(sid));
    Check(count>0,"invalid integrity SID");int rid=Marshal.ReadInt32(GetSidSubAuthority(sid,(uint)(count-1)));Check(rid==8192,"Medium integrity required: BLOCKED");
    using(var identity=WindowsIdentity.GetCurrent()){TokenEvidence=new{elevation,integrityRid=rid,userSid=identity.User.Value,pid=GetProcessId(GetCurrentProcess())};}
   }finally{Marshal.FreeHGlobal(data);CloseAll(token);}
  }
  static long Created(IntPtr h){long c,e,k,u;Check(GetProcessTimes(h,out c,out e,out k,out u),"process identity unavailable");return c;}
  static object Identity(IntPtr h){return new{pid=GetProcessId(h),createdFileTime=Created(h).ToString(System.Globalization.CultureInfo.InvariantCulture),handle=h.ToInt64().ToString("x"),signalled=WaitForSingleObject(h,0)==0};}
  static void NoReparse(string path){for(string p=Path.GetFullPath(path);!String.IsNullOrEmpty(p);p=Path.GetDirectoryName(p))Check((File.GetAttributes(p)&FileAttributes.ReparsePoint)==0,"reparse path BLOCKED");}
  static void Literal(string path){Check(Path.IsPathRooted(path)&&!path.StartsWith("\\\\")&&path.IndexOf('/')<0&&path.Substring(2).IndexOf(':')<0,"literal local path required");Check(String.Equals(Path.GetFullPath(path),path,StringComparison.OrdinalIgnoreCase),"path alias BLOCKED");foreach(string p in path.Substring(3).Split('\\'))Check(p.Length>0&&p!="."&&p!=".."&&!p.EndsWith(".")&&!p.EndsWith(" "),"path alias BLOCKED");}
  static void Write(string path,object value){string temp=path+".partial";File.WriteAllText(temp,Json.Serialize(value));File.Move(temp,path);}
  static void Until(Func<bool> condition,int ms,string why){var t=Stopwatch.StartNew();while(!condition()){Check(t.ElapsedMilliseconds<ms,why);Thread.Sleep(10);}}
  static void SaveIdentity(string path,IntPtr h){Write(path,new{pid=GetProcessId(h),createdFileTime=Created(h).ToString(System.Globalization.CultureInfo.InvariantCulture)});}
  static IntPtr Capture(string path){
   var id=Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(path));uint pid=Convert.ToUInt32(id["pid"]);long created=Convert.ToInt64(id["createdFileTime"]);
   IntPtr h=OpenProcess(0x00100000|0x1000,false,pid);Check(h!=IntPtr.Zero,"process handle capture failed");
   try{Check(GetProcessId(h)==pid&&Created(h)==created,"PID reuse/identity mismatch");return h;}catch{CloseHandle(h);throw;}
  }
  static void CaseDirectory(string dir){Literal(dir);NoReparse(dir);string name=Path.GetFileName(dir);Check(Array.IndexOf(new[]{"normal","timeout","crash","assignment","cleanup"},name)>=0,"unknown fixed case");
   Suite=Path.GetDirectoryName(dir);Check(File.ReadAllText(Path.Combine(Suite,"synthetic-session.txt"))=="fixed-fixtures-only;not-operator-authorization","missing test coordinator");
  }
  static int Root(string dir,string kind){
   CaseDirectory(dir);Check(Path.GetFileName(dir)==kind,"root scenario mismatch");bool member;Check(IsProcessInJob(GetCurrentProcess(),IntPtr.Zero,out member)&&member,"root not contained");
   foreach(string key in new[]{"NODE_OPTIONS","NODE_PATH","DATABASE_URL","PGHOST","PGPASSWORD","MATH_UNIVERSE_TEST_DATABASE_URL"})Check(Environment.GetEnvironmentVariable(key)==null,"inherited environment BLOCKED");
   var k=new WindowsJobKernel();IntPtr leaf=IntPtr.Zero,thread=IntPtr.Zero;
   try{k.CreateSuspended(Self,new[]{"--leaf",dir},dir,out leaf,out thread);Check(IsProcessInJob(leaf,IntPtr.Zero,out member)&&member,"leaf not inherited into job before Resume");SaveIdentity(Path.Combine(dir,"leaf.identity.json"),leaf);Until(()=>File.Exists(Path.Combine(dir,"leaf.assigned")),5000,"owner leaf membership confirmation deadline");k.Resume(thread);
    Until(()=>File.Exists(Path.Combine(dir,"leaf.started")),5000,"leaf startup timeout");SaveIdentity(Path.Combine(dir,"root.identity.json"),GetCurrentProcess());
    if(kind=="timeout"||kind=="crash")Thread.Sleep(60000);else Until(()=>File.Exists(Path.Combine(dir,"observer.ready")),5000,"observer capture timeout");return 17;
   }finally{CloseAll(thread,leaf);}
  }
  static int Leaf(string dir){CaseDirectory(dir);bool member;Check(IsProcessInJob(GetCurrentProcess(),IntPtr.Zero,out member)&&member,"leaf not contained");File.WriteAllText(Path.Combine(dir,"leaf.started"),"started");Thread.Sleep(60000);return 0;}
  sealed class Observed : IJobKernel {
   readonly WindowsJobKernel k=new WindowsJobKernel();readonly string dir;readonly string kind;
   public IntPtr RootHandle,LeafHandle;IntPtr OwnedJob;public bool Assigned,Resumed,Drained;public bool DrainRejected,LeafAssignedBeforeResume;public int NativeAssignmentError;
   public readonly List<string> Calls=new List<string>();
   public Observed(string d,string c){dir=d;kind=c;}
   public IntPtr CreateJob(){Calls.Add("create-job");OwnedJob=k.CreateJob();return OwnedJob;}
   public void ConfigureKillOnClose(IntPtr j){Calls.Add("kill-on-close");k.ConfigureKillOnClose(j);}
   public void CreateSuspended(string e,string[] a,string d,out IntPtr p,out IntPtr t){Calls.Add("create-suspended");k.CreateSuspended(e,a,d,out p,out t);SaveIdentity(Path.Combine(dir,"suspended.identity.json"),p);RootHandle=Capture(Path.Combine(dir,"suspended.identity.json"));Check(!File.Exists(Path.Combine(dir,"root.identity.json")),"fixture ran before assignment");}
   public void Assign(IntPtr j,IntPtr p){Calls.Add("assign");if(kind=="assignment"){try{k.Assign(IntPtr.Zero,p);}catch(System.ComponentModel.Win32Exception e){NativeAssignmentError=e.NativeErrorCode;Calls.Add("native-assignment-rejected:"+NativeAssignmentError);throw new InvalidOperationException("injected assignment failure",e);}throw new InvalidOperationException("invalid job unexpectedly accepted");}k.Assign(j,p);bool member;Check(IsProcessInJob(p,j,out member)&&member,"assignment not confirmed");Assigned=true;}
   public void Resume(IntPtr t){Check(Assigned,"Resume without ownership");Calls.Add("resume");k.Resume(t);Resumed=true;}
   public uint Wait(IntPtr p,uint ms){
    if(Resumed&&LeafHandle==IntPtr.Zero){var clock=Stopwatch.StartNew();Until(()=>File.Exists(Path.Combine(dir,"leaf.identity.json")),(int)Math.Min(ms,5000),"leaf identity timeout");LeafHandle=Capture(Path.Combine(dir,"leaf.identity.json"));bool member;Check(IsProcessInJob(LeafHandle,OwnedJob,out member)&&member&&!File.Exists(Path.Combine(dir,"leaf.started")),"leaf ownership before Resume unconfirmed");LeafAssignedBeforeResume=true;Calls.Add("leaf-assigned-before-resume");Write(Path.Combine(dir,"membership.json"),new{leafAssignedBeforeResume=true,leafPid=GetProcessId(LeafHandle),leafCreatedFileTime=Created(LeafHandle).ToString(System.Globalization.CultureInfo.InvariantCulture)});File.WriteAllText(Path.Combine(dir,"leaf.assigned"),"owned inner job confirmed");Until(()=>File.Exists(Path.Combine(dir,"root.identity.json")),(int)Math.Max(1,(long)ms-clock.ElapsedMilliseconds),"root readiness timeout");File.WriteAllText(Path.Combine(dir,"observer.ready"),"process handles captured, no job handle");return k.Wait(p,(uint)Math.Max(0,(long)ms-clock.ElapsedMilliseconds));}
    return k.Wait(p,ms);
   }
   public uint ExitCode(IntPtr p){return k.ExitCode(p);}
   public void TerminateJob(IntPtr j){Calls.Add("terminate-job");k.TerminateJob(j);}
   public bool WaitJobEmpty(IntPtr j,uint ms){Drained=k.WaitJobEmpty(j,ms);Calls.Add("drain="+Drained);if(kind=="cleanup"){DrainRejected=true;return false;}return Drained;}
   public void TerminateProcess(IntPtr p){Calls.Add("terminate-process");k.TerminateProcess(p);}
   public void Close(IntPtr h){k.Close(h);}
   public object Finish(){
    try{Check(RootHandle!=IntPtr.Zero&&WaitForSingleObject(RootHandle,5000)==0,"root handle not signalled");if(LeafHandle!=IntPtr.Zero)Check(WaitForSingleObject(LeafHandle,5000)==0,"leaf handle not signalled");return new{root=Identity(RootHandle),leaf=LeafHandle==IntPtr.Zero?null:Identity(LeafHandle),calls=Calls,assigned=Assigned,resumed=Resumed,drained=Drained,drainRejected=DrainRejected,nativeAssignmentError=NativeAssignmentError,leafAssignedBeforeResume=LeafAssignedBeforeResume};}
    finally{CloseAll(RootHandle,LeafHandle);}
   }
  }
  static int Owner(string dir,string kind){
   CaseDirectory(dir);Check(Array.IndexOf(new[]{"normal","timeout","crash","assignment","cleanup"},kind)>=0&&Path.GetFileName(dir)==kind,"unknown owner scenario");
   var observed=new Observed(dir,kind);bool expected=false;string error=null;
   try{uint result=Containment.RunOwned(observed,Self,new[]{"--root",dir,kind},dir,kind=="timeout"?4000u:15000u);Check(kind=="normal"&&result==17,"unexpected completion");expected=true;}
   catch(TimeoutException e){expected=kind=="timeout";error=e.Message;}
   catch(InvalidOperationException e){expected=(kind=="assignment"&&e.Message=="injected assignment failure")||(kind=="cleanup"&&e.Message.Contains("job drain unconfirmed"));error=e.Message;}
   catch(Exception e){error=e.GetType().FullName+":"+e.Message;}
   object handles=null;try{handles=observed.Finish();}catch(Exception e){expected=false;error=e.Message;}
   Check(kind!="crash","crash owner unexpectedly returned");
   if(kind=="assignment")expected=expected&&!observed.Assigned&&!observed.Resumed&&!File.Exists(Path.Combine(dir,"root.identity.json"));
   else expected=expected&&observed.Assigned&&observed.Resumed&&observed.Drained&&(kind!="cleanup"||observed.DrainRejected);
   Write(Path.Combine(dir,"owner-result.json"),new{status=expected?"PASS":"FAIL",scenario=kind,error,handles});return expected?0:1;
  }
  static object Supervise(string kind){
   string dir=Path.Combine(Suite,kind);Directory.CreateDirectory(dir);NoReparse(dir);var k=new WindowsJobKernel();IntPtr job=IntPtr.Zero,owner=IntPtr.Zero,thread=IntPtr.Zero,root=IntPtr.Zero,leaf=IntPtr.Zero;bool assigned=false,cleanupConfirmed=false;var clock=Stopwatch.StartNew();object outcome=null;
   try{job=k.CreateJob();k.ConfigureKillOnClose(job);k.CreateSuspended(Self,new[]{"--owner",dir,kind},dir,out owner,out thread);k.Assign(job,owner);assigned=true;k.Resume(thread);
    if(kind=="crash"){
     Until(()=>File.Exists(Path.Combine(dir,"root.identity.json")),8000,"crash tree startup timeout");root=Capture(Path.Combine(dir,"root.identity.json"));leaf=Capture(Path.Combine(dir,"leaf.identity.json"));
     var membership=Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(dir,"membership.json")));Check(Convert.ToBoolean(membership["leafAssignedBeforeResume"])&&Convert.ToUInt32(membership["leafPid"])==GetProcessId(leaf)&&Convert.ToInt64(membership["leafCreatedFileTime"])==Created(leaf),"crash ownership witness mismatch");
     Check(WaitForSingleObject(root,0)==258&&WaitForSingleObject(leaf,0)==258,"crash processes already exited");k.TerminateProcess(owner);Check(k.Wait(owner,5000)==0,"owner crash not confirmed");
     Check(WaitForSingleObject(root,5000)==0&&WaitForSingleObject(leaf,5000)==0,"kill-on-close descendants survived");
     outcome=new{status="PASS",scenario=kind,owner=Identity(owner),root=Identity(root),leaf=Identity(leaf),innerJobHandleHeldByObserver=false,leafAssignedBeforeResume=true};
    }else{
     Check(k.Wait(owner,25000)==0,"independent owner watchdog expired");Check(k.ExitCode(owner)==0,"owner reported FAIL; inspect owner-result.json");
     outcome=Json.DeserializeObject(File.ReadAllText(Path.Combine(dir,"owner-result.json")));
    }
    return outcome;
   }finally{
    try{if(assigned){k.TerminateJob(job);Check(k.WaitJobEmpty(job,5000),"outer watchdog cleanup unconfirmed");cleanupConfirmed=true;}else if(owner!=IntPtr.Zero){k.TerminateProcess(owner);Check(k.Wait(owner,5000)==0,"unassigned owner cleanup unconfirmed");}}
    finally{CloseAll(root,leaf,thread,owner,job);Evidence.Add(new{scenario=kind,elapsedMs=clock.ElapsedMilliseconds,outerCleanupConfirmed=cleanupConfirmed});}
   }
  }
  public static int Main(string[] args){
   try{
    Check(!String.Equals(Environment.MachineName,"ADMINIT",StringComparison.OrdinalIgnoreCase),"ADMINIT isolation criteria not integrated: BLOCKED");AssertMedium();
    Check(args.Length>=2,"fixed role and directory required");
    if(args[0]=="--leaf"&&args.Length==2)return Leaf(args[1]);
    if(args[0]=="--root"&&args.Length==3)return Root(args[1],args[2]);
    if(args[0]=="--owner"&&args.Length==3)return Owner(args[1],args[2]);
    Check(args[0]=="--hosted-suite"&&args.Length==2,"local execution policy BLOCKED");
    Check(Environment.GetEnvironmentVariable("GITHUB_ACTIONS")=="true"&&Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT")=="github-hosted","disposable hosted gate BLOCKED");
    Suite=args[1];Literal(Suite);string parent=Path.GetDirectoryName(Suite);NoReparse(parent);string temp=Path.GetFullPath(Environment.GetEnvironmentVariable("RUNNER_TEMP"))+"\\";
    Check(Suite.StartsWith(temp,StringComparison.OrdinalIgnoreCase)&&!Directory.Exists(Suite),"fresh hosted lab required");Directory.CreateDirectory(Suite);File.WriteAllText(Path.Combine(Suite,"synthetic-session.txt"),"fixed-fixtures-only;not-operator-authorization");
    var results=new List<object>();bool ok=true;
    foreach(string kind in new[]{"normal","timeout","crash","assignment","cleanup"}){
     try{results.Add(Supervise(kind));}catch(Exception e){ok=false;results.Add(new{scenario=kind,status="FAIL",error=e.GetType().FullName+":"+e.Message});}
    }
    Write(Path.Combine(Suite,"results.json"),new{sourceHead=Environment.GetEnvironmentVariable("SOURCE_HEAD"),sourceTree=Environment.GetEnvironmentVariable("SOURCE_TREE"),token="non-elevated Medium",tokenEvidence=TokenEvidence,results,evidence=Evidence,localExecution="BLOCKED_PENDING_ISOLATION_REVIEW"});Console.WriteLine(File.ReadAllText(Path.Combine(Suite,"results.json")));return ok?0:1;
   }catch(Exception e){Console.Error.WriteLine("BLOCKED: "+e.Message);return 2;}
  }
 }
}
