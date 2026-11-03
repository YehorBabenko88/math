namespace MathUniverse.AdminitHosted {
 using System;
 using System.IO;
 using System.Diagnostics;
 using System.Runtime.InteropServices;
 using System.Text;
 using System.Collections.Generic;
 using System.Web.Script.Serialization;
 using MathUniverse.Q01;
// BEGIN_READ_ONLY_ACCESS_PROBE
 public static class RestrictedFileAccessProbe {
  [StructLayout(LayoutKind.Sequential)] struct Mapping {public uint Read,Write,Execute,All;}
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool DuplicateToken(IntPtr token,int level,out IntPtr duplicate);
  [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool GetFileSecurity(string path,uint information,IntPtr descriptor,uint length,out uint needed);
  [DllImport("advapi32.dll")] static extern void MapGenericMask(ref uint access,ref Mapping mapping);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool AccessCheck(IntPtr descriptor,IntPtr token,uint access,ref Mapping mapping,IntPtr privileges,ref uint privilegeLength,out uint granted,[MarshalAs(UnmanagedType.Bool)] out bool allowed);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
  public sealed class Result {
   public bool available,allowed;public string failureClass="PROBE_UNAVAILABLE";
   public Result Block(string value){available=false;allowed=false;failureClass=value;return this;}
  }
  public static Result Check(IntPtr restricted,string path,uint desired){
   var result=new Result();IntPtr token=IntPtr.Zero,descriptor=IntPtr.Zero,privileges=IntPtr.Zero;
   try{
    if(!Path.IsPathRooted(path)||path.StartsWith("\\\\")||path.IndexOf('/')>=0||path.Substring(2).IndexOf(':')>=0||!String.Equals(path,Path.GetFullPath(path),StringComparison.OrdinalIgnoreCase))return result.Block("PATH_REJECTED");
    for(string cursor=path;!String.IsNullOrEmpty(cursor);cursor=Path.GetDirectoryName(cursor))if((File.GetAttributes(cursor)&FileAttributes.ReparsePoint)!=0)return result.Block("PATH_REJECTED");
    // A detached impersonation-token handle is used only as AccessCheck input.
    // Never attach it to a thread/process or adjust privileges/security policy.
    if(!DuplicateToken(restricted,2,out token))return result.Block("TOKEN_DUPLICATE_FAILED");
    uint required;bool initial=GetFileSecurity(path,7,IntPtr.Zero,0,out required);
    if(initial||Marshal.GetLastWin32Error()!=122)return result.Block("SECURITY_DESCRIPTOR_UNAVAILABLE");
    if(required<20||required>65536)return result.Block("SECURITY_DESCRIPTOR_BOUNDS");
    descriptor=Marshal.AllocHGlobal((int)required);uint actual;
    if(!GetFileSecurity(path,7,descriptor,required,out actual))return result.Block("SECURITY_DESCRIPTOR_UNAVAILABLE");
    if(actual<20||actual>required)return result.Block("SECURITY_DESCRIPTOR_BOUNDS");
    var mapping=new Mapping{Read=0x120089,Write=0x120116,Execute=0x1200A0,All=0x1F01FF};MapGenericMask(ref desired,ref mapping);
    privileges=Marshal.AllocHGlobal(65536);uint privilegeLength=65536,granted;bool allowed;
    if(!AccessCheck(descriptor,token,desired,ref mapping,privileges,ref privilegeLength,out granted,out allowed)||privilegeLength>65536)return result.Block("ACCESS_CHECK_UNAVAILABLE");
    result.available=true;result.allowed=allowed;result.failureClass="NONE";return result;
   }catch{return result.Block("PROBE_UNAVAILABLE");}
   finally{
    if(privileges!=IntPtr.Zero)Marshal.FreeHGlobal(privileges);if(descriptor!=IntPtr.Zero)Marshal.FreeHGlobal(descriptor);
    if(token!=IntPtr.Zero&&!CloseHandle(token))result.Block("RESOURCE_RELEASE_FAILED");
   }
  }
  static void Emit(IntPtr token,string name,string path,uint rights){
   var result=Check(token,path,rights);
   Console.Out.WriteLine("HOSTED_ACCESS_PROBE name="+name+" available="+(result.available?"true":"false")+" allowed="+(result.allowed?"true":"false")+" class="+result.failureClass);
  }
  public static void EmitFixed(IntPtr token,string packageExe,string packageRoot,string runParent){
   Emit(token,"PACKAGE_EXE_READ_EXECUTE",packageExe,0xA0000000);
   Emit(token,"PACKAGE_ROOT_LIST",packageRoot,1);
   Emit(token,"RUN_PARENT_CREATE_DIR",runParent,4);
   Emit(token,"RUN_PARENT_TEMP_WRITE",runParent,2);
  }
 }
// END_READ_ONLY_ACCESS_PROBE
 public static class MediumLauncher {
  [StructLayout(LayoutKind.Sequential)] struct Startup {public uint Size;public string Reserved,Desktop,Title;public uint X,Y,XS,YS,XC,YC,Fill,Flags;public ushort Show,RS;public IntPtr R2,Input,Output,Error;}
  [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {public IntPtr Process,Thread;public uint Pid,Tid;}
  [StructLayout(LayoutKind.Sequential)] struct SidAttributes {public IntPtr Sid;public uint Attributes;}
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr p,uint access,out IntPtr token);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool CreateRestrictedToken(IntPtr token,uint flags,uint disable,IntPtr sids,uint delete,IntPtr privileges,uint restrict,IntPtr restrictions,out IntPtr result);
  [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool ConvertStringSidToSid(string text,out IntPtr sid);
  [DllImport("advapi32.dll")] static extern uint GetLengthSid(IntPtr sid);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool SetTokenInformation(IntPtr token,int kind,IntPtr info,uint size);
  [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessAsUser(IntPtr token,string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref Startup startup,out ProcessInfo result);
  [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr h);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  static void Check(bool ok,string why){if(!ok)throw new InvalidOperationException(why+" win32="+Marshal.GetLastWin32Error());}
  static string Quote(string s){Check(!String.IsNullOrEmpty(s)&&s.IndexOf('"')<0&&s.IndexOf('\r')<0&&s.IndexOf('\n')<0&&!s.EndsWith("\\"),"invalid fixed path");return "\""+s+"\"";}
  public static string ChildExitClass(uint code){
   if(code==0)return "SUCCESS";
   if(code==1)return "SCENARIO_FAILURE";
   if(code==2)return "MANAGED_GATE_BLOCKED";
   if(code==0xC0000142)return "DLL_INITIALIZATION_FAILED";
   if(code==0xC0000135)return "DLL_NOT_FOUND";
   if(code==0xC000007B)return "INVALID_IMAGE_FORMAT";
   if(code==0xC0000005)return "ACCESS_VIOLATION";
   if(code==0xE0434352)return "CLR_EXCEPTION";
   return "OTHER_NONZERO";
  }
  public static int Main(string[] args){
   IntPtr token=IntPtr.Zero,limited=IntPtr.Zero,sid=IntPtr.Zero,label=IntPtr.Zero,env=IntPtr.Zero,job=IntPtr.Zero,p=IntPtr.Zero,t=IntPtr.Zero;bool assigned=false;var k=new WindowsJobKernel();int result=2;
   string phase="HOSTED_GUARD";
   try{
    Check(Environment.GetEnvironmentVariable("GITHUB_ACTIONS")=="true"&&Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT")=="github-hosted"&&!String.Equals(Environment.MachineName,"ADMINIT",StringComparison.OrdinalIgnoreCase),"hosted-only bootstrap BLOCKED");
    phase="ROOTS";
    Check(args.Length==2,"fixed package/run roots required");string temp=Path.GetFullPath(Environment.GetEnvironmentVariable("RUNNER_TEMP"))+"\\";string package=Path.GetFullPath(args[0]),run=Path.GetFullPath(args[1]);
    Check(package.StartsWith(temp,StringComparison.OrdinalIgnoreCase)&&run.StartsWith(temp,StringComparison.OrdinalIgnoreCase)&&!Directory.Exists(run),"hosted temporary roots required");string exe=Path.Combine(package,"AdminitSyntheticHarness.exe");Check(File.Exists(exe),"fixed executable missing");
    phase="TOKEN_QUERY";
    Check(OpenProcessToken(GetCurrentProcess(),11|0x80,out token),"caller token query");phase="TOKEN_CREATE";Check(CreateRestrictedToken(token,5,0,IntPtr.Zero,0,IntPtr.Zero,0,IntPtr.Zero,out limited),"restricted token creation BLOCKED");
    phase="INTEGRITY_SID";
    Check(ConvertStringSidToSid("S-1-16-8192",out sid),"Medium SID creation");label=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(SidAttributes)));Marshal.StructureToPtr(new SidAttributes{Sid=sid,Attributes=0x20},label,false);
    phase="INTEGRITY_ASSIGN";
    Check(SetTokenInformation(limited,25,label,(uint)Marshal.SizeOf(typeof(SidAttributes))+GetLengthSid(sid)),"Medium token assignment BLOCKED");
    RestrictedFileAccessProbe.EmitFixed(limited,exe,package,Path.GetDirectoryName(run));
    phase="ENVIRONMENT";
    var values=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);string windows=Environment.GetFolderPath(Environment.SpecialFolder.Windows);
    values.Add("GITHUB_ACTIONS","true");values.Add("RUNNER_ENVIRONMENT","github-hosted");values.Add("RUNNER_TEMP",Environment.GetEnvironmentVariable("RUNNER_TEMP"));values.Add("SOURCE_HEAD",Environment.GetEnvironmentVariable("SOURCE_HEAD"));values.Add("SOURCE_TREE",Environment.GetEnvironmentVariable("SOURCE_TREE"));values.Add("SystemRoot",windows);values.Add("TEMP",Path.GetDirectoryName(run));values.Add("TMP",Path.GetDirectoryName(run));values.Add("WINDIR",windows);
    var block=new StringBuilder();foreach(var pair in values){Check(pair.Value!=null&&pair.Value.IndexOf('\0')<0,"invalid fixed environment");block.Append(pair.Key).Append('=').Append(pair.Value).Append('\0');}block.Append('\0');env=Marshal.StringToHGlobalUni(block.ToString());
    Startup startup=new Startup();startup.Size=(uint)Marshal.SizeOf(typeof(Startup));ProcessInfo info;
    phase="JOB_CREATE";
    job=k.CreateJob();phase="JOB_CONFIGURE";k.ConfigureKillOnClose(job);
    phase="PROCESS_CREATE";
    Check(CreateProcessAsUser(limited,exe,new StringBuilder(Quote(exe)+" --hosted-suite "+Quote(run)),IntPtr.Zero,IntPtr.Zero,false,4|0x400|0x08000000,env,package,ref startup,out info),"restricted fixed process creation BLOCKED; no privilege enabling/fallback");
    p=info.Process;t=info.Thread;phase="JOB_ASSIGN";k.Assign(job,p);assigned=true;phase="THREAD_RESUME";k.Resume(t);
    phase="PROCESS_WAIT";
    Check(k.Wait(p,120000)==0,"independent whole-suite watchdog expired: BLOCKED");phase="CHILD_RESULT";result=(int)k.ExitCode(p);if(result!=0)Console.WriteLine("HOSTED_BOOTSTRAP_PHASE="+phase);if(result!=0)Console.WriteLine("HOSTED_CHILD_FAILURE class="+ChildExitClass(unchecked((uint)result)));Console.WriteLine("Fixed Medium supervisor exit="+result+"; inspect results.json; missing evidence is BLOCKED");return result;
   }catch(Exception e){Console.Out.WriteLine("HOSTED_BOOTSTRAP_PHASE="+phase);Console.Error.WriteLine("BLOCKED: "+e.Message);return 2;}
   finally{
    phase="CLEANUP";
    try {
    try{if(assigned){k.TerminateJob(job);Check(k.WaitJobEmpty(job,5000),"bootstrap descendant drain unconfirmed");}else if(p!=IntPtr.Zero){k.TerminateProcess(p);Check(k.Wait(p,5000)==0,"unassigned supervisor cleanup unconfirmed");}}
    finally{bool closed=true;foreach(IntPtr h in new[]{p,t,job,token,limited})if(h!=IntPtr.Zero)closed=CloseHandle(h)&&closed;if(sid!=IntPtr.Zero)LocalFree(sid);if(label!=IntPtr.Zero)Marshal.FreeHGlobal(label);if(env!=IntPtr.Zero)Marshal.FreeHGlobal(env);Check(closed,"bootstrap owned handle close failed");}
    }catch{Console.Out.WriteLine("HOSTED_BOOTSTRAP_PHASE="+phase);throw;}
   }
  }
 }
}
