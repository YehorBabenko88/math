// Diagnostic only: no ACL, registry, token privilege or target-memory writes.
using System;using System.IO;using System.Text;using System.Collections.Generic;using System.Diagnostics;using System.Runtime.InteropServices;using System.Web.Script.Serialization;
public static class LoaderTrace {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup {public uint Size;public string Reserved,Desktop,Title;public uint X,Y,XS,YS,XC,YC,Fill,Flags;public ushort Show,RS;public IntPtr R2,Input,Output,Error;}
 [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {public IntPtr Process,Thread;public uint Pid,Tid;}
 [StructLayout(LayoutKind.Sequential)] struct Security {public int Size;public IntPtr Descriptor;[MarshalAs(UnmanagedType.Bool)]public bool Inherit;}
 [StructLayout(LayoutKind.Explicit,Size=176)] struct Event {
  [FieldOffset(0)]public uint Code;[FieldOffset(4)]public uint Pid;[FieldOffset(8)]public uint Tid;
  [FieldOffset(16)]public IntPtr A;[FieldOffset(24)]public IntPtr B;[FieldOffset(32)]public IntPtr C;[FieldOffset(40)]public IntPtr D;
  [FieldOffset(16)]public uint Value;[FieldOffset(168)]public uint FirstChance;
  [FieldOffset(40)]public uint ParameterCount;[FieldOffset(48)]public ulong P0;[FieldOffset(56)]public ulong P1;[FieldOffset(64)]public ulong P2;
  [FieldOffset(24)]public ushort Unicode;[FieldOffset(26)]public ushort Length;
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CreateProcess(string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref Startup startup,out ProcessInfo process);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool WaitForDebugEventEx(out Event value,uint ms);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool ContinueDebugEvent(uint pid,uint tid,uint status);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool DebugSetProcessKillOnExit(bool kill);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool DuplicateHandle(IntPtr source,IntPtr handle,IntPtr target,out IntPtr duplicate,uint access,bool inherit,uint options);
 [DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool ReadProcessMemory(IntPtr process,IntPtr address,byte[] buffer,UIntPtr size,out UIntPtr read);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern uint GetFinalPathNameByHandle(IntPtr file,StringBuilder name,uint length,uint flags);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint WaitForSingleObject(IntPtr process,uint ms);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateFile(string name,uint access,uint share,ref Security sa,uint creation,uint flags,IntPtr template);
 static void Check(bool ok){if(!ok)throw new InvalidOperationException("native diagnostic error="+Marshal.GetLastWin32Error());}
 static void Close(IntPtr h){if(h!=IntPtr.Zero&&h!=new IntPtr(-1))Check(CloseHandle(h));}
 static string Quote(string s){if(s.IndexOf('"')>=0||s.EndsWith("\\"))throw new ArgumentException();return "\""+s+"\"";}
 static string FileName(IntPtr h){if(h==IntPtr.Zero||h==new IntPtr(-1))return "UNAVAILABLE";var b=new StringBuilder(4096);uint n=GetFinalPathNameByHandle(h,b,4096,0);return n>0&&n<4096?b.ToString():"UNAVAILABLE";}
 static readonly List<object> Events=new List<object>();
 public static int Main(){
  if(IntPtr.Size!=8||Environment.GetEnvironmentVariable("GITHUB_ACTIONS")!="true"||Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT")!="github-hosted"||String.Equals(Environment.MachineName,"ADMINIT",StringComparison.OrdinalIgnoreCase))return 2;
  string temp=Path.GetFullPath(Environment.GetEnvironmentVariable("RUNNER_TEMP")),root=Path.Combine(temp,"loader-diagnostic"),build=Path.Combine(temp,"adminit-build"),exe=Path.Combine(build,"HostedMediumLauncher.exe");
  if(Directory.Exists(root)||!File.Exists(exe))return 2;
  for(string path=temp;!String.IsNullOrEmpty(path);path=Path.GetDirectoryName(path))if((File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)return 2;
  Directory.CreateDirectory(root);var owned=new List<IntPtr>();var processHandles=new List<IntPtr>();var processes=new Dictionary<uint,IntPtr>();var breakpoints=new HashSet<string>();bool collected=false,cleanup=false,rootExited=false;string error=null;int textBytes=0;var clock=Stopwatch.StartNew();
  try{
   var sa=new Security{Size=Marshal.SizeOf(typeof(Security)),Inherit=true};
   IntPtr output=CreateFile(Path.Combine(root,"bootstrap-stdout.txt"),0x40000000,1,ref sa,1,0x80,IntPtr.Zero);Check(output!=new IntPtr(-1));owned.Add(output);
   IntPtr stderr=CreateFile(Path.Combine(root,"bootstrap-stderr.txt"),0x40000000,1,ref sa,1,0x80,IntPtr.Zero);Check(stderr!=new IntPtr(-1));owned.Add(stderr);
   IntPtr input=CreateFile("NUL",0x80000000,3,ref sa,3,0x80,IntPtr.Zero);Check(input!=new IntPtr(-1));owned.Add(input);
   var startup=new Startup{Size=(uint)Marshal.SizeOf(typeof(Startup)),Flags=0x100,Input=input,Output=output,Error=stderr};ProcessInfo original;
   // DEBUG_PROCESS observes descendants. Never disable debugger kill-on-exit.
   Check(CreateProcess(exe,new StringBuilder(Quote(exe)+" "+Quote(Path.Combine(build,"package"))+" "+Quote(Path.Combine(temp,"adminit-native"))),IntPtr.Zero,IntPtr.Zero,true,1|0x08000000,IntPtr.Zero,build,ref startup,out original));
   processHandles.Add(original.Process);owned.Add(original.Process);owned.Add(original.Thread);Check(DebugSetProcessKillOnExit(true));
   while(!rootExited||processes.Count>0){
    Check(clock.ElapsedMilliseconds<150000&&Events.Count<20000&&textBytes<4194304);Event e;
    if(!WaitForDebugEventEx(out e,1000)){Check(Marshal.GetLastWin32Error()==121);continue;}
    uint continuation=0x00010002;var row=new Dictionary<string,object>{{"event",e.Code},{"pid",e.Pid},{"tid",e.Tid},{"elapsedMs",clock.ElapsedMilliseconds}};
    try{
     if(e.Code==3){try{IntPtr duplicate;Check(DuplicateHandle(GetCurrentProcess(),e.B,GetCurrentProcess(),out duplicate,0,false,2));processHandles.Add(duplicate);owned.Add(duplicate);processes.Add(e.Pid,duplicate);row.Add("image",FileName(e.A));row.Add("base",e.D.ToInt64().ToString("x"));}finally{Close(e.A);}}
     else if(e.Code==6){try{row.Add("dll",FileName(e.A));row.Add("base",e.B.ToInt64().ToString("x"));}finally{Close(e.A);}}
     else if(e.Code==1){row.Add("exception",e.Value.ToString("x8"));row.Add("address",e.C.ToInt64().ToString("x"));row.Add("firstChance",e.FirstChance);row.Add("parameterCount",e.ParameterCount);row.Add("firstThreeParameters",new[]{e.P0.ToString("x"),e.P1.ToString("x"),e.P2.ToString("x")});if((e.Value!=0x80000003&&e.Value!=0x4000001f)||e.FirstChance==0||!breakpoints.Add(e.Pid+":"+e.Value))continuation=0x80010001;}
     else if(e.Code==5){row.Add("exit",e.Value.ToString("x8"));processes.Remove(e.Pid);if(e.Pid==original.Pid)rootExited=true;}
     else if(e.Code==8){int length=e.Length*(e.Unicode==0?1:2);if(length>0&&length<=65536){var bytes=new byte[length];UIntPtr n;IntPtr process;if(processes.TryGetValue(e.Pid,out process)&&ReadProcessMemory(process,e.A,bytes,(UIntPtr)(uint)length,out n)&&n.ToUInt64()==(ulong)length){row.Add("debugString",(e.Unicode==0?Encoding.Default:Encoding.Unicode).GetString(bytes));textBytes+=length;}}}
     Events.Add(row);
    }finally{Check(ContinueDebugEvent(e.Pid,e.Tid,continuation));}
   }
   // Duplicated process handles remain valid after EXIT_PROCESS was continued.
   foreach(var h in processHandles)Check(WaitForSingleObject(h,5000)==0);
   collected=true;
  }catch(Exception e){error=e.GetType().FullName+":"+e.Message;}
  finally{
   bool drained=true;
   foreach(var p in processHandles){if(WaitForSingleObject(p,0)!=0)TerminateProcess(p,2);if(WaitForSingleObject(p,5000)!=0)drained=false;}
   // No DebugActiveProcessStop: kernel kill-on-debugger-exit stays enabled.
   foreach(IntPtr h in owned)try{Close(h);}catch{drained=false;}
   // Incomplete event collection cannot attest descendants not yet registered.
   cleanup=collected&&drained;
   File.WriteAllText(Path.Combine(root,"trace.json"),new JavaScriptSerializer{MaxJsonLength=8388608}.Serialize(new{schema=1,scope="DIAGNOSTIC_ONLY_NOT_NATIVE_ACCEPTANCE",collected,cleanup,error,sourceHead=Environment.GetEnvironmentVariable("SOURCE_HEAD"),sourceTree=Environment.GetEnvironmentVariable("SOURCE_TREE"),events=Events}));
  }
  Console.WriteLine("LOADER_TRACE_RECORDED; NATIVE_ACCEPTANCE_BLOCKED");return collected&&cleanup?0:2;
 }
}
