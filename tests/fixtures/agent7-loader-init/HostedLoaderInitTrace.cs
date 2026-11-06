// NON_QUALIFYING owned SYSTEM_CMD observer. Local entry point is MODEL ONLY.
// Native Main requires the existing hosted/office-deny predicate and fixed pins.
namespace MathUniverse.Agent7 {
 using System;using System.IO;using System.Text;using System.Diagnostics;
 using System.Collections.Generic;using System.Runtime.InteropServices;using System.Security.Cryptography;
 using MathUniverse.AdminitHosted;using MathUniverse.Q01;
 public sealed class TraceEvent {
  public uint Kind,Pid,Tid,Code,FirstChance;public IntPtr Image;
  public string Module="NONE";
 }
 public interface ITracePlatform {
  long Now{get;} bool Begin();bool HasChild{get;}
  bool Wait(out TraceEvent item,uint milliseconds);bool Continue(TraceEvent item,uint status);
  bool CloseImage(TraceEvent item);bool Stop();bool Finish(uint milliseconds,bool exitContinued);
 }
 public sealed class TraceResult {
  public string Outcome="UNAVAILABLE",FirstException="NONE",LastModule="NONE";
  public int Events;public bool BreakpointHandled,Cleanup;
 }
 public static class LoaderInitTrace {
  const uint Handled=0x00010002,NotHandled=0x80010001;
  static bool Safe(Func<bool> f){try{return f();}catch{return false;}}
  static string ExceptionClass(uint c){return c==0xc0000005?"ACCESS_VIOLATION":c==0xc0000142?"DLL_INITIALIZATION_FAILED":c==0xc0000135?"DLL_NOT_FOUND":c==0xc000007b?"INVALID_IMAGE_FORMAT":c==0x80000003?"BREAKPOINT":"OTHER";}
  static string ExitClass(uint c){return c==71?"DEBUGGER_PERTURBED_BASELINE":c==0xc0000142?"DLL_INITIALIZATION_FAILED":c==0xc0000135?"DLL_NOT_FOUND":c==0xc000007b?"INVALID_IMAGE_FORMAT":"OTHER_EXIT";}
  public static TraceResult Observe(ITracePlatform p) {
   if(p==null)throw new ArgumentException();var r=new TraceResult();bool exited=false,healthy=true,created=false;uint pid=0;
   long started=p.Now;TraceEvent pending=null;bool imageClosed=false;
   try {
    if(!p.Begin())throw new InvalidOperationException();
    while(!exited) {
     if(p.Now-started>=10000){r.Outcome="DEADLINE";break;}
     if(r.Events>=256){r.Outcome="EVENT_LIMIT";break;}
     TraceEvent e;if(!p.Wait(out e,(uint)Math.Min(100,10000-(p.Now-started))))continue;
     pending=e;imageClosed=false;r.Events++;
     if(e==null)throw new InvalidOperationException();
     uint status=Handled;bool terminal=false,initialBreakpointThisEvent=false;
     try {
      if(e.Kind==3) {if(created)throw new InvalidOperationException();created=true;pid=e.Pid;}
      else if(!created||e.Pid!=pid)throw new InvalidOperationException();
      if(e.Kind==3||e.Kind==6) {
       if(!new List<string>{"NONE","OS_NTDLL","OS_KERNEL32","OS_KERNELBASE","OS_USER32","OS_WIN32U","OTHER","UNAVAILABLE"}.Contains(e.Module))throw new InvalidOperationException();
       r.LastModule=e.Module;
      } else if(e.Kind==1) {
       // Only the first first-chance breakpoint after CREATE_PROCESS is treated
       // as the debugger's initial breakpoint; any later breakpoint is forwarded.
       if(e.Code==0x80000003&&e.FirstChance==1&&!r.BreakpointHandled&&r.FirstException=="NONE"){r.BreakpointHandled=true;initialBreakpointThisEvent=true;}
       else {status=NotHandled;if(r.FirstException=="NONE")r.FirstException=ExceptionClass(e.Code);}
      } else if(e.Kind==5) {r.Outcome=ExitClass(e.Code);terminal=true;}
      else if(e.Kind!=2&&e.Kind!=4&&e.Kind!=7&&e.Kind!=8&&e.Kind!=9&&e.Kind!=3)throw new InvalidOperationException();
     } finally {
      imageClosed=true;if(!Safe(()=>p.CloseImage(e)))healthy=false;
      // Genuine exception forwarding also applies when an event is rejected.
      if(e.Kind==1&&!initialBreakpointThisEvent)status=NotHandled;
      bool continued=Safe(()=>p.Continue(e,status));pending=null;
      if(!continued){healthy=false;throw new InvalidOperationException();}
      if(terminal)exited=true;
     }
    }
   } catch {r.Outcome="PROTOCOL_FAILURE";}
   finally {
    // Never abandon a suspended debug event. Kill only the owned child/job,
    // then drain EXIT through ContinueDebugEvent before confirming signal/job.
    long cleanupStart=p.Now;if(!Safe(()=>p.Stop()))healthy=false;
    if(pending!=null) {
     TraceEvent e=pending;if(!imageClosed&&!Safe(()=>p.CloseImage(e)))healthy=false;
     if(!Safe(()=>p.Continue(e,e.Kind==1?NotHandled:Handled)))healthy=false;
    }
    while(p.HasChild&&!exited&&r.Events<256&&p.Now-cleanupStart<5000) {
     TraceEvent e=null;try {
      uint remain=(uint)Math.Max(0,5000-(p.Now-cleanupStart));
      if(!p.Wait(out e,Math.Min(100,remain)))continue;r.Events++;
      if(e==null){healthy=false;break;}
      if(!Safe(()=>p.CloseImage(e)))healthy=false;
      bool done=Safe(()=>p.Continue(e,e.Kind==1?NotHandled:Handled));
      if(!done){healthy=false;break;}if(e.Kind==5)exited=true;
     }catch{healthy=false;break;}
    }
    uint budget=(uint)Math.Max(0,5000-(p.Now-cleanupStart));
    bool finished=Safe(()=>p.Finish(budget,exited));
    r.Cleanup=healthy&&finished&&(!p.HasChild||exited);
    if(!r.Cleanup)r.Outcome="CLEANUP_UNCONFIRMED";
   }
   return r;
  }
  static void Need(bool ok){if(!ok)throw new InvalidOperationException();}
  static bool Hosted(){return HostedPrivateDesktop.IsHostedContext(Environment.GetEnvironmentVariable("GITHUB_ACTIONS"),Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT"),Environment.GetEnvironmentVariable("RUNNER_OS"),Environment.GetEnvironmentVariable("GITHUB_REPOSITORY"),Environment.GetEnvironmentVariable("GITHUB_RUN_ID"),Environment.GetEnvironmentVariable("GITHUB_RUN_ATTEMPT"),Environment.MachineName);}
  static string Hash(FileStream f){f.Position=0;using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(f)).Replace("-","").ToLowerInvariant();}
  internal static void NoLinks(string path){Need(Path.IsPathRooted(path)&&!path.StartsWith("\\\\"));for(string p=path;!String.IsNullOrEmpty(p);p=Path.GetDirectoryName(p))Need((File.GetAttributes(p)&FileAttributes.ReparsePoint)==0);}
  static string Public(TraceResult r,string head,string tree){return "{\"schema\":\"math.loader-init-trace.v1\",\"head\":\""+head+"\",\"tree\":\""+tree+"\",\"qualification\":\"NONE\",\"nativeAcceptance\":\"BLOCKED\",\"outcome\":\""+r.Outcome+"\",\"events\":"+r.Events+",\"breakpointHandled\":"+(r.BreakpointHandled?"true":"false")+",\"firstException\":\""+r.FirstException+"\",\"lastModule\":\""+r.LastModule+"\",\"cleanup\":\""+(r.Cleanup?"CONFIRMED":"UNCONFIRMED")+"\"}";}
  public static int Main(string[] args){
   var r=new TraceResult{Cleanup=true};string head="",tree="";
   try {
    // Predicate must precede even construction of the native backend.
    Need(Hosted()&&IntPtr.Size==8&&args.Length==3);
    Need(System.Text.RegularExpressions.Regex.IsMatch(args[1],@"\A[0-9a-f]{40}\z")&&System.Text.RegularExpressions.Regex.IsMatch(args[2],@"\A[0-9a-f]{40}\z"));head=args[1];tree=args[2];
    Need(head==Environment.GetEnvironmentVariable("SOURCE_HEAD")&&tree==Environment.GetEnvironmentVariable("SOURCE_TREE"));
    string temp=Path.GetFullPath(Environment.GetEnvironmentVariable("RUNNER_TEMP")).TrimEnd('\\')+"\\",build=Path.GetFullPath(args[0]);Need(build.StartsWith(temp,StringComparison.OrdinalIgnoreCase));NoLinks(build);NoLinks(Path.Combine(build,"package"));
    string exe=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"cmd.exe");NoLinks(exe);
    string pinPath=Path.Combine(build,"os-control.sha256");NoLinks(pinPath);byte[] pin=new byte[65];using(var pf=new FileStream(pinPath,FileMode.Open,FileAccess.Read,FileShare.Read)){Need(pf.Length==65);int at=0,n;while(at<65&&(n=pf.Read(pin,at,65-at))>0)at+=n;Need(at==65&&pin[64]==10);}string expected=Encoding.ASCII.GetString(pin,0,64);Need(System.Text.RegularExpressions.Regex.IsMatch(expected,@"\A[0-9a-f]{64}\z"));
    using(var image=new FileStream(exe,FileMode.Open,FileAccess.Read,FileShare.Read)) {
     long length=image.Length;Need(length>0&&length<=134217728&&Hash(image)==expected);
     r=Observe(new NativeTrace(exe,Path.Combine(build,"package")));
     if(image.Length!=length||Hash(image)!=expected)r.Outcome=r.Cleanup?"UNAVAILABLE":"CLEANUP_UNCONFIRMED";
    }
   }catch{r.Outcome=r.Cleanup?"UNAVAILABLE":"CLEANUP_UNCONFIRMED";}
   if(head.Length!=40||tree.Length!=40)return 2;
   Console.Out.Write(Public(r,head,tree)+"\n");return r.Cleanup?0:2;
  }
  sealed class Fake:ITracePlatform {
   public readonly Queue<TraceEvent> Items=new Queue<TraceEvent>();public readonly List<uint> Status=new List<uint>();
   public long Clock;public uint Step=100;public bool Child=true,BeginOk=true,StopOk=true,FinishOk=true,CloseOk=true,ContinueOk=true,ThrowWait,ExitOnStop;public int Closed,Stops,Finished;public uint Budget;
   public long Now{get{return Clock;}}public bool HasChild{get{return Child;}}
   public bool Begin(){return BeginOk;}public bool Wait(out TraceEvent e,uint ms){Need(ms<=100);Clock+=Math.Min(ms,Step);if(ThrowWait)throw new InvalidOperationException();e=Items.Count>0?Items.Dequeue():null;return e!=null;}
   public bool Continue(TraceEvent e,uint status){Status.Add(status);return ContinueOk;}
   public bool CloseImage(TraceEvent e){if(e.Image!=IntPtr.Zero)Closed++;return CloseOk;}
   public bool Stop(){Stops++;if(ExitOnStop)Items.Enqueue(E(5,0));return StopOk;}public bool Finish(uint ms,bool exit){Budget=ms;Finished++;return FinishOk&&(!Child||exit);}
  }
  static TraceEvent E(uint kind,uint code){return new TraceEvent{Kind=kind,Pid=1,Tid=1,Code=code,FirstChance=1,Image=(kind==3||kind==6)?new IntPtr(8):IntPtr.Zero,Module="OS_NTDLL"};}
  static Fake Normal(){var f=new Fake();f.Items.Enqueue(E(3,0));f.Items.Enqueue(E(1,0x80000003));f.Items.Enqueue(E(5,0xc0000142));return f;}
  public static string RunModelTests(){int n=0;
   Need(Marshal.SizeOf(typeof(NativeTrace.DebugEvent))==176&&Marshal.OffsetOf(typeof(NativeTrace.DebugEvent),"Data").ToInt32()==16&&Marshal.OffsetOf(typeof(NativeTrace.DebugEvent),"FirstChance").ToInt32()==168);n++;
   foreach(string denied in new[]{"LS-5","ADMINIT","PC1","LS07"})Need(!HostedPrivateDesktop.IsHostedContext("true","github-hosted","Windows","YehorBabenko88/math","1","1",denied));n++;
   var f=Normal();var r=Observe(f);Need(r.Cleanup&&r.Outcome=="DLL_INITIALIZATION_FAILED"&&r.BreakpointHandled&&f.Closed==1&&f.Stops==1&&f.Finished==1);n++;
   f=Normal();f.Items.Clear();f.Items.Enqueue(E(3,0));f.Items.Enqueue(E(1,0xc0000005));f.Items.Enqueue(E(1,0x80000003));f.Items.Enqueue(E(1,0x80000003));f.Items.Enqueue(E(5,71));r=Observe(f);Need(r.Cleanup&&!r.BreakpointHandled&&r.FirstException=="ACCESS_VIOLATION"&&f.Status[1]==NotHandled&&f.Status[2]==NotHandled&&f.Status[3]==NotHandled&&r.Outcome=="DEBUGGER_PERTURBED_BASELINE");n++;
   f=Normal();f.Items.Clear();f.Items.Enqueue(E(3,0));f.Items.Enqueue(E(1,0x80000003));f.Items.Enqueue(E(1,0x80000003));f.Items.Enqueue(E(5,0));r=Observe(f);Need(r.Cleanup&&r.FirstException=="BREAKPOINT"&&f.Status[1]==Handled&&f.Status[2]==NotHandled);n++;
   f=Normal();f.Items.Clear();f.Items.Enqueue(E(3,0));f.Items.Enqueue(E(1,0x80000003));var foreign=E(1,0x80000003);foreign.Pid=2;f.Items.Enqueue(foreign);f.Items.Enqueue(E(5,0));r=Observe(f);Need(r.Cleanup&&r.Outcome=="PROTOCOL_FAILURE"&&f.Status[2]==NotHandled);n++;
   foreach(int failure in new[]{0,1,2,3}){f=Normal();if(failure==0)f.StopOk=false;if(failure==1)f.FinishOk=false;if(failure==2)f.CloseOk=false;if(failure==3)f.ContinueOk=false;r=Observe(f);Need(!r.Cleanup&&r.Outcome=="CLEANUP_UNCONFIRMED"&&f.Stops==1&&f.Finished==1);n++;}
   f=new Fake();f.Child=false;f.BeginOk=false;r=Observe(f);Need(r.Cleanup&&r.Outcome=="PROTOCOL_FAILURE");n++;
   f=new Fake();f.Items.Enqueue(E(3,0));r=Observe(f);Need(!r.Cleanup&&r.Outcome=="CLEANUP_UNCONFIRMED"&&f.Clock<=15000&&f.Budget<=5000);n++;
   f=new Fake();f.Step=0;for(int i=0;i<300;i++)f.Items.Enqueue(E(i==0?3u:8u,0));r=Observe(f);Need(r.Events==256&&!r.Cleanup&&f.Finished==1);n++;
   f=new Fake();f.ExitOnStop=true;f.Items.Enqueue(E(3,0));r=Observe(f);Need(r.Cleanup&&r.Outcome=="DEADLINE"&&f.Clock<=15000);n++;
   f=Normal();f.Items.Clear();f.Items.Enqueue(E(3,0));var invalid=E(6,0);invalid.Module="private path";f.Items.Enqueue(invalid);f.Items.Enqueue(E(5,0));r=Observe(f);Need(r.Cleanup&&r.Outcome=="PROTOCOL_FAILURE"&&r.LastModule=="OS_NTDLL"&&f.Closed==2);n++;
   f=Normal();f.ThrowWait=true;r=Observe(f);Need(!r.Cleanup&&f.Stops==1&&f.Finished==1);n++;
   f=Normal();f.Items.Clear();f.Items.Enqueue(E(3,0));f.Items.Enqueue(E(99,0));f.Items.Enqueue(E(5,0));r=Observe(f);Need(r.Cleanup&&r.Outcome=="PROTOCOL_FAILURE"&&f.Status.Count==3);n++;
   return "MODEL_ONLY cases="+n+" qualification=NONE";
  }
 }
 // No public native factory or configurable executable. Main supplies the sole
 // pinned system command after actual hosted guard; MODEL never constructs this.
 sealed class NativeTrace:ITracePlatform {
  [StructLayout(LayoutKind.Sequential)]struct SidAttributes{public IntPtr Sid;public uint Attributes;}
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct Startup{public uint Size;public string Reserved,Desktop,Title;public uint X,Y,XSize,YSize,XCount,YCount,Fill,Flags;public ushort Show,ReservedSize;public IntPtr ReservedBytes,Input,Output,Error;}
  [StructLayout(LayoutKind.Sequential)]struct Info{public IntPtr Process,Thread;public uint Pid,Tid;}
  [StructLayout(LayoutKind.Explicit,Size=176)]internal struct DebugEvent {
   [FieldOffset(0)]public uint Kind;[FieldOffset(4)]public uint Pid;[FieldOffset(8)]public uint Tid;
   [FieldOffset(16)]public IntPtr Data;[FieldOffset(24)]public IntPtr Process;[FieldOffset(32)]public IntPtr Thread;
   [FieldOffset(16)]public uint Code;[FieldOffset(168)]public uint FirstChance;
  }
  [DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")]static extern IntPtr LocalFree(IntPtr h);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool DuplicateHandle(IntPtr source,IntPtr h,IntPtr target,out IntPtr result,uint access,bool inherit,uint options);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool WaitForDebugEvent(out DebugEvent e,uint ms);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool ContinueDebugEvent(uint pid,uint tid,uint status);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern uint GetFinalPathNameByHandle(IntPtr file,StringBuilder name,uint size,uint flags);
  [DllImport("advapi32.dll",SetLastError=true)]static extern bool OpenProcessToken(IntPtr p,uint access,out IntPtr token);
  [DllImport("advapi32.dll",SetLastError=true)]static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr p,uint n,out uint needed);
  [DllImport("advapi32.dll",SetLastError=true)]static extern bool CreateRestrictedToken(IntPtr token,uint flags,uint n,IntPtr sids,uint del,IntPtr priv,uint restrict,IntPtr rsids,out IntPtr result);
  [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool ConvertStringSidToSid(string s,out IntPtr sid);
  [DllImport("advapi32.dll")]static extern uint GetLengthSid(IntPtr sid);
  [DllImport("advapi32.dll",SetLastError=true)]static extern bool SetTokenInformation(IntPtr token,int kind,IntPtr data,uint n);
  [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CreateProcessAsUser(IntPtr token,string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref Startup startup,out Info info);
  readonly string exe,cwd;readonly WindowsJobKernel kernel=new WindowsJobKernel();readonly Stopwatch clock=Stopwatch.StartNew();
  readonly HashSet<IntPtr> debugOwned=new HashSet<IntPtr>();
  IntPtr parent,limited,sid,label,env,job,process,thread,signal;bool assigned,child,closeHealthy=true;
  public NativeTrace(string exe,string cwd){this.exe=exe;this.cwd=cwd;}
  public long Now{get{return clock.ElapsedMilliseconds;}}public bool HasChild{get{return child;}}
  static void Need(bool ok){if(!ok)throw new InvalidOperationException();}
  static bool MayLower(IntPtr token){IntPtr p=IntPtr.Zero;try{uint n;GetTokenInformation(token,25,IntPtr.Zero,0,out n);Need(Marshal.GetLastWin32Error()==122&&n>=IntPtr.Size+4&&n<=65536);p=Marshal.AllocHGlobal((int)n);uint actual;Need(GetTokenInformation(token,25,p,n,out actual)&&actual<=n);IntPtr s=Marshal.ReadIntPtr(p);long at=s.ToInt64()-p.ToInt64();Need(at>=0&&at+12<=actual&&Marshal.ReadByte(s)==1&&Marshal.ReadByte(s,1)==1);uint rid=unchecked((uint)Marshal.ReadInt32(s,8));return rid==8192||rid==12288;}finally{if(p!=IntPtr.Zero)Marshal.FreeHGlobal(p);}}
  public bool Begin(){
   Need(OpenProcessToken(GetCurrentProcess(),11|0x80,out parent)&&MayLower(parent));
   Need(CreateRestrictedToken(parent,5,0,IntPtr.Zero,0,IntPtr.Zero,0,IntPtr.Zero,out limited));
   Need(ConvertStringSidToSid("S-1-16-8192",out sid));label=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(SidAttributes)));Marshal.StructureToPtr(new SidAttributes{Sid=sid,Attributes=0x20},label,false);Need(SetTokenInformation(limited,25,label,(uint)Marshal.SizeOf(typeof(SidAttributes))+GetLengthSid(sid)));
   var values=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
   foreach(string k in new[]{"GITHUB_ACTIONS","RUNNER_ENVIRONMENT","RUNNER_TEMP","SOURCE_HEAD","SOURCE_TREE"})values.Add(k,Environment.GetEnvironmentVariable(k));
   string windows=Environment.GetFolderPath(Environment.SpecialFolder.Windows);LoaderInitTrace.NoLinks(windows);
   values.Add("SystemRoot",windows);values.Add("WINDIR",windows);values.Add("TEMP",Environment.GetEnvironmentVariable("RUNNER_TEMP"));values.Add("TMP",Environment.GetEnvironmentVariable("RUNNER_TEMP"));
   var block=new StringBuilder();foreach(var v in values){Need(v.Value!=null&&v.Value.IndexOf('\0')<0);block.Append(v.Key).Append('=').Append(v.Value).Append('\0');}block.Append('\0');env=Marshal.StringToHGlobalUni(block.ToString());
   job=kernel.CreateJob();kernel.ConfigureKillOnClose(job);var startup=new Startup();startup.Size=(uint)Marshal.SizeOf(typeof(Startup));Info info;
   Need(CreateProcessAsUser(limited,exe,new StringBuilder("\""+exe+"\" /d /c exit 71"),IntPtr.Zero,IntPtr.Zero,false,0x08000406,env,cwd,ref startup,out info));
   process=info.Process;thread=info.Thread;child=true;
   Need(DuplicateHandle(GetCurrentProcess(),process,GetCurrentProcess(),out signal,0,false,2));
   kernel.Assign(job,process);assigned=true;kernel.Resume(thread);return true;
  }
  static string Role(IntPtr file){if(file==IntPtr.Zero)return "UNAVAILABLE";var b=new StringBuilder(1024);uint n=GetFinalPathNameByHandle(file,b,1024,0);if(n==0||n>=1024)return "UNAVAILABLE";string path=b.ToString();string system=Environment.GetFolderPath(Environment.SpecialFolder.System).TrimEnd('\\')+"\\";if(path.StartsWith("\\\\?\\"))path=path.Substring(4);if(!path.StartsWith(system,StringComparison.OrdinalIgnoreCase))return "OTHER";string name=path.Substring(system.Length).ToLowerInvariant();return name=="ntdll.dll"?"OS_NTDLL":name=="kernel32.dll"?"OS_KERNEL32":name=="kernelbase.dll"?"OS_KERNELBASE":name=="user32.dll"?"OS_USER32":name=="win32u.dll"?"OS_WIN32U":"OTHER";}
  public bool Wait(out TraceEvent item,uint milliseconds){
   Need(milliseconds<=100);DebugEvent e;if(!WaitForDebugEvent(out e,milliseconds)){Need(Marshal.GetLastWin32Error()==121);item=null;return false;}
   item=new TraceEvent{Kind=e.Kind,Pid=e.Pid,Tid=e.Tid,Code=e.Code,FirstChance=e.FirstChance};
   // These process/thread handles are debugger-owned: OS closes them after
   // continued EXIT events. Track aliasing with caller PI handles explicitly.
   if(e.Kind==3){debugOwned.Add(e.Process);debugOwned.Add(e.Thread);}
   if(e.Kind==2)debugOwned.Add(e.Data);
   if(e.Kind==3||e.Kind==6){item.Image=e.Data;try{item.Module=Role(e.Data);}catch{item.Module="UNAVAILABLE";}}
   return true;
  }
  public bool CloseImage(TraceEvent e){return e.Image==IntPtr.Zero||CloseHandle(e.Image);}
  public bool Continue(TraceEvent e,uint status){return ContinueDebugEvent(e.Pid,e.Tid,status);}
  public bool Stop(){try{if(child){if(assigned)kernel.TerminateJob(job);else kernel.TerminateProcess(process);}return true;}catch{return false;}}
  public bool Finish(uint milliseconds,bool exitContinued){long start=Now;bool ok=true;
   try{if(child){ok=exitContinued&&signal!=IntPtr.Zero&&kernel.Wait(signal,milliseconds)==0;uint remain=(uint)Math.Max(0,milliseconds-(Now-start));if(assigned)ok=kernel.WaitJobEmpty(job,remain)&&ok;}}
   catch{ok=false;}
   finally {
    foreach(IntPtr h in new[]{signal,thread,process,job,limited,parent})if(h!=IntPtr.Zero&&!debugOwned.Contains(h)&&!CloseHandle(h))closeHealthy=false;
    if(label!=IntPtr.Zero)Marshal.FreeHGlobal(label);if(sid!=IntPtr.Zero&&LocalFree(sid)!=IntPtr.Zero)closeHealthy=false;if(env!=IntPtr.Zero)Marshal.FreeHGlobal(env);
   }
   return ok&&closeHealthy;
  }
 }
}
