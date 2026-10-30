namespace MathUniverse.AdminitHosted {
 using System;
 using System.IO;
 using System.Diagnostics;
 using System.Runtime.InteropServices;
 using System.Text;
 using System.Collections.Generic;
 using System.Web.Script.Serialization;
 using MathUniverse.Q01;
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
  public static int Main(string[] args){
   IntPtr token=IntPtr.Zero,limited=IntPtr.Zero,sid=IntPtr.Zero,label=IntPtr.Zero,env=IntPtr.Zero,job=IntPtr.Zero,p=IntPtr.Zero,t=IntPtr.Zero;bool assigned=false;var k=new WindowsJobKernel();int result=2;
   try{
    Check(Environment.GetEnvironmentVariable("GITHUB_ACTIONS")=="true"&&Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT")=="github-hosted"&&!String.Equals(Environment.MachineName,"ADMINIT",StringComparison.OrdinalIgnoreCase),"hosted-only bootstrap BLOCKED");
    Check(args.Length==2,"fixed package/run roots required");string temp=Path.GetFullPath(Environment.GetEnvironmentVariable("RUNNER_TEMP"))+"\\";string package=Path.GetFullPath(args[0]),run=Path.GetFullPath(args[1]);
    Check(package.StartsWith(temp,StringComparison.OrdinalIgnoreCase)&&run.StartsWith(temp,StringComparison.OrdinalIgnoreCase)&&!Directory.Exists(run),"hosted temporary roots required");string exe=Path.Combine(package,"AdminitSyntheticHarness.exe");Check(File.Exists(exe),"fixed executable missing");
    // CreateRestrictedToken preserves handle access rights. Integrity assignment
    // needs TOKEN_ADJUST_DEFAULT in addition to ASSIGN_PRIMARY|DUPLICATE|QUERY.
    Check(OpenProcessToken(GetCurrentProcess(),0x8b,out token),"caller token query");Check(CreateRestrictedToken(token,5,0,IntPtr.Zero,0,IntPtr.Zero,0,IntPtr.Zero,out limited),"restricted token creation BLOCKED");
    Check(ConvertStringSidToSid("S-1-16-8192",out sid),"Medium SID creation");label=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(SidAttributes)));Marshal.StructureToPtr(new SidAttributes{Sid=sid,Attributes=0x20},label,false);
    Check(SetTokenInformation(limited,25,label,(uint)Marshal.SizeOf(typeof(SidAttributes))+GetLengthSid(sid)),"Medium token assignment BLOCKED");
    var values=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);string windows=Environment.GetFolderPath(Environment.SpecialFolder.Windows);
    values.Add("GITHUB_ACTIONS","true");values.Add("RUNNER_ENVIRONMENT","github-hosted");values.Add("RUNNER_TEMP",Environment.GetEnvironmentVariable("RUNNER_TEMP"));values.Add("SOURCE_HEAD",Environment.GetEnvironmentVariable("SOURCE_HEAD"));values.Add("SOURCE_TREE",Environment.GetEnvironmentVariable("SOURCE_TREE"));values.Add("SystemRoot",windows);values.Add("TEMP",Path.GetDirectoryName(run));values.Add("TMP",Path.GetDirectoryName(run));values.Add("WINDIR",windows);
    var block=new StringBuilder();foreach(var pair in values){Check(pair.Value!=null&&pair.Value.IndexOf('\0')<0,"invalid fixed environment");block.Append(pair.Key).Append('=').Append(pair.Value).Append('\0');}block.Append('\0');env=Marshal.StringToHGlobalUni(block.ToString());
    Startup startup=new Startup();startup.Size=(uint)Marshal.SizeOf(typeof(Startup));ProcessInfo info;
    job=k.CreateJob();k.ConfigureKillOnClose(job);
    Check(CreateProcessAsUser(limited,exe,new StringBuilder(Quote(exe)+" --hosted-suite "+Quote(run)),IntPtr.Zero,IntPtr.Zero,false,4|0x400|0x08000000,env,package,ref startup,out info),"restricted fixed process creation BLOCKED; no privilege enabling/fallback");
    p=info.Process;t=info.Thread;k.Assign(job,p);assigned=true;k.Resume(t);
    Check(k.Wait(p,120000)==0,"independent whole-suite watchdog expired: BLOCKED");result=(int)k.ExitCode(p);Console.WriteLine("Fixed Medium supervisor exit="+result+"; inspect results.json; missing evidence is BLOCKED");return result;
   }catch(Exception e){Console.Error.WriteLine("BLOCKED: "+e.Message);return 2;}
   finally{
    try{if(assigned){k.TerminateJob(job);Check(k.WaitJobEmpty(job,5000),"bootstrap descendant drain unconfirmed");}else if(p!=IntPtr.Zero){k.TerminateProcess(p);Check(k.Wait(p,5000)==0,"unassigned supervisor cleanup unconfirmed");}}
    finally{bool closed=true;foreach(IntPtr h in new[]{p,t,job,token,limited})if(h!=IntPtr.Zero)closed=CloseHandle(h)&&closed;if(sid!=IntPtr.Zero)LocalFree(sid);if(label!=IntPtr.Zero)Marshal.FreeHGlobal(label);if(env!=IntPtr.Zero)Marshal.FreeHGlobal(env);Check(closed,"bootstrap owned handle close failed");}
    Console.WriteLine("BOOTSTRAP_CLEANUP_CONFIRMED");
   }
  }
 }
}
