// Dormant preparation only. No production entry point loads this type.
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
namespace MathUniverse.Q01 {
 public interface IJobKernel {
  IntPtr CreateJob(); void ConfigureKillOnClose(IntPtr job);
  void CreateSuspended(string executable, string[] arguments, string directory, out IntPtr process, out IntPtr thread);
  void Assign(IntPtr job, IntPtr process); void Resume(IntPtr thread);
  uint Wait(IntPtr process, uint milliseconds); uint ExitCode(IntPtr process);
  void TerminateJob(IntPtr job); void TerminateProcess(IntPtr process); void Close(IntPtr handle);
 }
 public static class Containment {
  public const uint CleanupMilliseconds = 5000;
  // Public only to permit injected, native-free acceptance fixtures. This is not an execution authorization API.
  public static uint Run(IJobKernel native, string executable, string[] arguments, string directory, uint deadlineMilliseconds) {
   if (native == null || arguments == null) throw new ArgumentException("missing containment inputs");
   ValidateDirectory(directory);
   if (!Path.IsPathRooted(executable) || !File.Exists(executable)) throw new ArgumentException("absolute existing executable required");
   NoReparse(executable);
   if (deadlineMilliseconds == 0 || deadlineMilliseconds > 3600000) throw new ArgumentException("deadline BLOCKED");
   return RunOwned(native, executable, arguments, directory, deadlineMilliseconds);
  }
  internal static uint RunOwned(IJobKernel native, string executable, string[] arguments, string directory, uint deadlineMilliseconds) {
   IntPtr job=IntPtr.Zero, process=IntPtr.Zero, thread=IntPtr.Zero;
   bool assigned=false, exited=false;
   var clock=Stopwatch.StartNew();
   try {
    job=native.CreateJob();
    if (job==IntPtr.Zero) throw new InvalidOperationException("missing job");
    native.ConfigureKillOnClose(job);
    native.CreateSuspended(executable, arguments, directory, out process, out thread);
    if (process==IntPtr.Zero || thread==IntPtr.Zero) throw new InvalidOperationException("missing process handles");
    native.Assign(job, process); assigned=true;
    if (clock.ElapsedMilliseconds >= deadlineMilliseconds) throw new TimeoutException("containment deadline");
    native.Resume(thread);
    long remaining=deadlineMilliseconds-clock.ElapsedMilliseconds;
    if (remaining <= 0 || native.Wait(process, (uint)remaining)!=0) throw new TimeoutException("containment deadline/wait failure");
    exited=true;
    return native.ExitCode(process);
   } finally {
    // Terminate descendants even when the root has exited. A failed assignment must
    // kill the still-suspended process by its owned handle, never by a reusable PID.
    try {
     if (job!=IntPtr.Zero && assigned) native.TerminateJob(job);
    } finally {
     try {
      if (process!=IntPtr.Zero && !exited) {
       native.TerminateProcess(process);
       if (native.Wait(process, CleanupMilliseconds)!=0) throw new InvalidOperationException("cleanup unconfirmed: BLOCKED");
      }
     } finally {
      try { if (thread!=IntPtr.Zero) native.Close(thread); }
      finally { try { if (process!=IntPtr.Zero) native.Close(process); } finally { if (job!=IntPtr.Zero) native.Close(job); } }
     }
    }
   }
  }
  public static void ValidateDirectory(string path) {
   const string root=@"C:\Users\Administrator\AppData\Local\MathUniverseLab";
   if (String.IsNullOrEmpty(path) || !path.StartsWith(root+"\\",StringComparison.OrdinalIgnoreCase) || path.IndexOf('/')>=0 || path.Substring(2).IndexOf(':')>=0) throw new ArgumentException("literal lab descendant required");
   foreach(string part in path.Substring(3).Split('\\')) if (part.Length==0 || part=="." || part==".." || part.EndsWith(".") || part.EndsWith(" ")) throw new ArgumentException("lab alias BLOCKED");
   if (!String.Equals(Path.GetFullPath(path),path,StringComparison.OrdinalIgnoreCase) || !Directory.Exists(path)) throw new ArgumentException("existing literal lab directory required");
   NoReparse(path);
  }
  static void NoReparse(string path) {
   for(string p=Path.GetFullPath(path); !String.IsNullOrEmpty(p); p=Path.GetDirectoryName(p))
    if ((File.GetAttributes(p)&FileAttributes.ReparsePoint)!=0) throw new ArgumentException("reparse BLOCKED");
  }
 }
 public sealed class WindowsJobKernel : IJobKernel {
  const uint CREATE_SUSPENDED=0x4, CREATE_UNICODE_ENVIRONMENT=0x400, CREATE_NO_WINDOW=0x08000000;
  const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE=0x2000;
  [StructLayout(LayoutKind.Sequential)] struct BasicLimits { public long PerProcess,PerJob; public uint Flags; public UIntPtr Minimum,Maximum; public uint Active; public UIntPtr Affinity; public uint Priority,Scheduling; }
  [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong A,B,C,D,E,F; }
  [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits { public BasicLimits Basic; public IoCounters Io; public UIntPtr ProcessMemory,JobMemory,PeakProcessMemory,PeakJobMemory; }
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup { public uint Size; public string Reserved,Desktop,Title; public uint X,Y,XSize,YSize,XChars,YChars,Fill,Flags; public ushort Show,ReservedSize; public IntPtr Reserved2,Input,Output,Error; }
  [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr Process,Thread; public uint Pid,Tid; }
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref ExtendedLimits info,uint size);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr environment,string cwd,ref Startup startup,out ProcessInfo info);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
  [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
  [DllImport("kernel32.dll",EntryPoint="TerminateProcess",SetLastError=true)] static extern bool KillProcess(IntPtr process,uint code);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
  static void Check(bool ok) { if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
  public IntPtr CreateJob() { IntPtr job=CreateJobObject(IntPtr.Zero,null); if(job==IntPtr.Zero) Check(false); return job; }
  public void ConfigureKillOnClose(IntPtr job) { var info=new ExtendedLimits(); info.Basic.Flags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE; Check(SetInformationJobObject(job,9,ref info,(uint)Marshal.SizeOf(typeof(ExtendedLimits)))); }
  static string Quote(string value) {
   if(value==null || value.IndexOf('\0')>=0 || value.IndexOf('\r')>=0 || value.IndexOf('\n')>=0) throw new ArgumentException("invalid argument");
   var b=new StringBuilder("\""); int slashes=0;
   foreach(char c in value) { if(c=='\\') { slashes++; continue; } if(c=='"') b.Append('\\',slashes*2+1); else b.Append('\\',slashes); b.Append(c); slashes=0; }
   return b.Append('\\',slashes*2).Append('"').ToString();
  }
  public void CreateSuspended(string executable,string[] arguments,string directory,out IntPtr process,out IntPtr thread) {
   var command=new StringBuilder(Quote(executable)); foreach(string argument in arguments) command.Append(' ').Append(Quote(argument));
   var startup=new Startup(); startup.Size=(uint)Marshal.SizeOf(typeof(Startup)); ProcessInfo info;
   // Explicit child-only environment: no inherited NODE_OPTIONS, secrets, or external TEMP.
   string windows=Environment.GetFolderPath(Environment.SpecialFolder.Windows);
   string environment="SystemRoot="+windows+"\0TEMP="+directory+"\0TMP="+directory+"\0WINDIR="+windows+"\0\0";
   IntPtr block=Marshal.StringToHGlobalUni(environment);
   try { Check(CreateProcess(executable,command,IntPtr.Zero,IntPtr.Zero,false,CREATE_SUSPENDED|CREATE_UNICODE_ENVIRONMENT|CREATE_NO_WINDOW,block,directory,ref startup,out info)); process=info.Process; thread=info.Thread; }
   finally { Marshal.FreeHGlobal(block); }
  }
  public void Assign(IntPtr job,IntPtr process) { Check(AssignProcessToJobObject(job,process)); }
  public void Resume(IntPtr thread) { if(ResumeThread(thread)!=1) throw new Win32Exception("unexpected suspended thread count"); }
  public uint Wait(IntPtr process,uint milliseconds) { return WaitForSingleObject(process,milliseconds); }
  public uint ExitCode(IntPtr process) { uint code; Check(GetExitCodeProcess(process,out code)); return code; }
  public void TerminateJob(IntPtr job) { Check(TerminateJobObject(job,2)); }
  public void TerminateProcess(IntPtr process) { Check(KillProcess(process,2)); }
  public void Close(IntPtr handle) { Check(CloseHandle(handle)); }
 }
}
