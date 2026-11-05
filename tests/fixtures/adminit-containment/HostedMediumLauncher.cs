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
// BEGIN_READ_ONLY_USER_OBJECT_PROBE
 // Microsoft primary references: security mappings, borrowed handles, label-only reads.
 // https://learn.microsoft.com/en-us/windows/win32/winstation/window-station-security-and-access-rights
 // https://learn.microsoft.com/en-us/windows/win32/winstation/desktop-security-and-access-rights
 // https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getprocesswindowstation
 // https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getthreaddesktop
 // https://learn.microsoft.com/en-us/windows/win32/secauthz/security-information
 public static class RestrictedUserObjectProbe {
  const int Limit=65536,MaxAces=1024;
  [StructLayout(LayoutKind.Sequential)] struct Mapping {public uint Read,Write,Execute,All;}
  [StructLayout(LayoutKind.Sequential)] struct Flags {public uint Inherit,Reserved,Value;}
  [DllImport("user32.dll",SetLastError=true)] static extern IntPtr GetProcessWindowStation();
  [DllImport("user32.dll",SetLastError=true)] static extern IntPtr GetThreadDesktop(uint thread);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll",SetLastError=true)] static extern bool GetUserObjectSecurity(IntPtr handle,ref uint information,IntPtr descriptor,uint length,out uint needed);
  [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool GetUserObjectInformation(IntPtr handle,int index,ref Flags flags,uint length,out uint needed);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool DuplicateToken(IntPtr token,int level,out IntPtr duplicate);
  [DllImport("advapi32.dll")] static extern void MapGenericMask(ref uint access,ref Mapping mapping);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool AccessCheck(IntPtr descriptor,IntPtr token,uint access,ref Mapping mapping,IntPtr privileges,ref uint length,out uint granted,[MarshalAs(UnmanagedType.Bool)] out bool allowed);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
  public sealed class Result {
   public string name,failureClass="PROBE_UNAVAILABLE";public bool available,allowed;
   public Result Block(string value){available=false;allowed=false;failureClass=value;return this;}
  }
  public sealed class Label {
   public bool available,noWriteUp,noReadUp,noExecuteUp;public string label="UNAVAILABLE",failureClass="LABEL_UNAVAILABLE";
   public Label Block(string value){available=false;label="UNAVAILABLE";failureClass=value;noWriteUp=false;noReadUp=false;noExecuteUp=false;return this;}
  }
  public sealed class Snapshot {
   public string station="UNAVAILABLE";
   public System.Collections.Generic.List<Result> rights=new System.Collections.Generic.List<Result>();
   public Label stationLabel=new Label(),desktopLabel=new Label();
  }
  // kind: 0 interactive station, 1 noninteractive station, 2 desktop.
  public static uint[] MappingValues(int kind){
   if(kind==0)return new uint[]{0x20303,0x2001C,0x20060,0xF037F};
   if(kind==1)return new uint[]{0x20103,0x2000C,0x20060,0xF016F};
   if(kind==2)return new uint[]{0x20041,0x200BE,0x20100,0xF01FF};
   throw new ArgumentOutOfRangeException("kind");
  }
  static uint[] Bits(int kind){return kind==2?new uint[]{1,2,4,8,0x10,0x20,0x40,0x80,0x100}:new uint[]{1,2,4,8,0x10,0x20,0x40,0x100,0x200};}
  static string[] Names(int kind){return kind==2?new[]{"DESKTOP_READ_OBJECTS","DESKTOP_CREATE_WINDOW","DESKTOP_CREATE_MENU","DESKTOP_HOOK_CONTROL","DESKTOP_JOURNAL_RECORD","DESKTOP_JOURNAL_PLAYBACK","DESKTOP_ENUMERATE","DESKTOP_WRITE_OBJECTS","DESKTOP_SWITCH"}:new[]{"WINSTA_ENUM_DESKTOPS","WINSTA_READ_ATTRIBUTES","WINSTA_ACCESS_CLIPBOARD","WINSTA_CREATE_DESKTOP","WINSTA_WRITE_ATTRIBUTES","WINSTA_ACCESS_GLOBAL_ATOMS","WINSTA_EXIT_WINDOWS","WINSTA_ENUMERATE","WINSTA_READ_SCREEN"};}
  public static Result CheckDescriptor(IntPtr restricted,byte[] raw,int kind,uint desired){
   var result=new Result();IntPtr descriptor=IntPtr.Zero,token=IntPtr.Zero,privileges=IntPtr.Zero;
   try{
    if(kind<0||kind>2)return result.Block("STATION_KIND_UNAVAILABLE");
    if(desired!=0x10000000&&Array.IndexOf(Bits(kind),desired)<0)return result.Block("UNSUPPORTED_RIGHT");
    if(raw==null||raw.Length<20||raw.Length>Limit)return result.Block("SECURITY_DESCRIPTOR_BOUNDS");
    var parsed=new System.Security.AccessControl.RawSecurityDescriptor(raw,0);
    if(parsed.Owner==null||parsed.Group==null||(parsed.DiscretionaryAcl!=null&&parsed.DiscretionaryAcl.Count>MaxAces)||(parsed.SystemAcl!=null&&parsed.SystemAcl.Count>MaxAces))return result.Block("SECURITY_DESCRIPTOR_BOUNDS");
    if(!DuplicateToken(restricted,2,out token))return result.Block("TOKEN_DUPLICATE_FAILED");
    descriptor=Marshal.AllocHGlobal(raw.Length);Marshal.Copy(raw,0,descriptor,raw.Length);
    uint[] values=MappingValues(kind);var mapping=new Mapping{Read=values[0],Write=values[1],Execute=values[2],All=values[3]};MapGenericMask(ref desired,ref mapping);
    privileges=Marshal.AllocHGlobal(Limit);uint length=Limit,granted;bool allowed;
    if(!AccessCheck(descriptor,token,desired,ref mapping,privileges,ref length,out granted,out allowed)||length>Limit)return result.Block("ACCESS_CHECK_UNAVAILABLE");
    result.available=true;result.allowed=allowed;result.failureClass="NONE";return result;
   }catch{return result.Block("PROBE_UNAVAILABLE");}
   finally{
    if(privileges!=IntPtr.Zero)Marshal.FreeHGlobal(privileges);if(descriptor!=IntPtr.Zero)Marshal.FreeHGlobal(descriptor);
    if(token!=IntPtr.Zero&&!CloseHandle(token))result.Block("RESOURCE_RELEASE_FAILED");
   }
  }
  static byte[] ReadDescriptor(IntPtr handle,uint information,out string failure){
   failure="HANDLE_UNAVAILABLE";IntPtr memory=IntPtr.Zero;
   try{
    if(handle==IntPtr.Zero)return null;
    uint needed;bool initial=GetUserObjectSecurity(handle,ref information,IntPtr.Zero,0,out needed);
    failure="SECURITY_DESCRIPTOR_UNAVAILABLE";if(initial||Marshal.GetLastWin32Error()!=122)return null;
    failure="SECURITY_DESCRIPTOR_BOUNDS";if(needed<20||needed>Limit)return null;
    memory=Marshal.AllocHGlobal((int)needed);uint actual;
    failure="SECURITY_DESCRIPTOR_UNAVAILABLE";if(!GetUserObjectSecurity(handle,ref information,memory,needed,out actual))return null;
    failure="SECURITY_DESCRIPTOR_BOUNDS";if(actual<20||actual>needed)return null;
    byte[] raw=new byte[actual];Marshal.Copy(memory,raw,0,(int)actual);failure="NONE";return raw;
   }catch{failure="PROBE_UNAVAILABLE";return null;}finally{if(memory!=IntPtr.Zero)Marshal.FreeHGlobal(memory);}
  }
  public static Label ParseLabel(byte[] raw){
   var result=new Label();
   try{
    if(raw==null||raw.Length<20||raw.Length>Limit||raw[0]!=1||(BitConverter.ToUInt16(raw,2)&0x8000)==0)return result.Block("LABEL_BOUNDS");
    result.available=true;result.label="UNLABELLED";result.failureClass="NONE";
    uint offset=BitConverter.ToUInt32(raw,12);
    if((BitConverter.ToUInt16(raw,2)&0x10)==0||offset==0)return result;
    if(offset<20||(ulong)offset+8>(ulong)raw.Length)return result.Block("LABEL_BOUNDS");
    int start=(int)offset,size=BitConverter.ToUInt16(raw,start+2),count=BitConverter.ToUInt16(raw,start+4);
    if((raw[start]!=2&&raw[start]!=4)||size<8||start+size>raw.Length||count>MaxAces)return result.Block("LABEL_BOUNDS");
    int cursor=start+8,end=start+size,labels=0;
    for(int index=0;index<count;index++){
     if(cursor+4>end)return result.Block("LABEL_BOUNDS");int aceSize=BitConverter.ToUInt16(raw,cursor+2);
     if(aceSize<4||cursor+aceSize>end)return result.Block("LABEL_BOUNDS");
     if(raw[cursor]==17){
      if(++labels>1||aceSize!=20||raw[cursor+8]!=1||raw[cursor+9]!=1)return result.Block("LABEL_BOUNDS");
      for(int i=10;i<15;i++)if(raw[cursor+i]!=0)return result.Block("LABEL_BOUNDS");
      if(raw[cursor+15]!=16)return result.Block("LABEL_BOUNDS");
      uint mask=BitConverter.ToUInt32(raw,cursor+4),rid=BitConverter.ToUInt32(raw,cursor+16);if((mask&~7u)!=0)return result.Block("LABEL_BOUNDS");
      result.label=rid==4096?"LOW":rid==8192?"MEDIUM":rid==12288?"HIGH":rid==16384?"SYSTEM":"OTHER";
      result.noWriteUp=(mask&1)!=0;result.noReadUp=(mask&2)!=0;result.noExecuteUp=(mask&4)!=0;
     }
     cursor+=aceSize;
    }
    return result;
   }catch{return result.Block("LABEL_BOUNDS");}
  }
  static Label ReadLabel(IntPtr handle){string failure;byte[] raw=ReadDescriptor(handle,16,out failure);return raw==null?new Label().Block(failure):ParseLabel(raw);}
  static void AddRights(Snapshot snapshot,IntPtr token,IntPtr handle,int kind){
   string failure;byte[] raw=ReadDescriptor(handle,7,out failure);uint[] bits=Bits(kind);string[] names=Names(kind);
   for(int index=0;index<10;index++){
    uint desired=index==9?0x10000000:bits[index];
    Result result=raw==null?new Result().Block(failure):CheckDescriptor(token,raw,kind,desired);
    result.name=index==9?(kind==2?"DESKTOP_GENERIC_ALL":"WINSTA_GENERIC_ALL"):names[index];snapshot.rights.Add(result);
   }
  }
  public sealed class DesktopSnapshot {public bool handleAvailable;public Result access=new Result().Block("HANDLE_UNAVAILABLE");public Label label=new Label().Block("HANDLE_UNAVAILABLE");}
  // GetThreadDesktop accepts a thread identifier returned by process creation; this is
  // a borrowed handle, never closed/rebound. Cross-process lookup/descriptor failures
  // remain explicitly unavailable and do not establish which desktop was selected.
  // https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getthreaddesktop
  public static DesktopSnapshot InspectDesktop(IntPtr restricted,uint thread){var value=new DesktopSnapshot();try{IntPtr handle=GetThreadDesktop(thread);if(handle==IntPtr.Zero)return value;value.handleAvailable=true;string failure;byte[] raw=ReadDescriptor(handle,7,out failure);value.access=raw==null?new Result().Block(failure):CheckDescriptor(restricted,raw,2,0x10000000);value.label=ReadLabel(handle);}catch{string failure=value.handleAvailable?"PROBE_UNAVAILABLE":"HANDLE_UNAVAILABLE";value.access.Block(failure);value.label.Block(failure);}return value;}
  public static void EmitChildFixed(IntPtr restricted,uint thread){try{var v=InspectDesktop(restricted,thread);Console.Out.WriteLine("HOSTED_CHILD_DESKTOP handle_available="+(v.handleAvailable?"true":"false")+" access_available="+(v.access.available?"true":"false")+" allowed="+(v.access.allowed?"true":"false")+" label_available="+(v.label.available?"true":"false")+" label="+v.label.label+" no_write_up="+(v.label.noWriteUp?"true":"false")+" no_read_up="+(v.label.noReadUp?"true":"false")+" no_execute_up="+(v.label.noExecuteUp?"true":"false")+" access_class="+v.access.failureClass+" label_class="+v.label.failureClass);}catch{}}

  public static Snapshot InspectCurrent(IntPtr restricted){
   var snapshot=new Snapshot();
   // These handles belong to the process/thread. Never close or reassign them.
   IntPtr station=GetProcessWindowStation(),desktop=GetThreadDesktop(GetCurrentThreadId());
   var flags=new Flags();uint needed;int kind=-1;
   if(station!=IntPtr.Zero&&GetUserObjectInformation(station,1,ref flags,12,out needed)&&needed==12&&flags.Reserved==0){kind=(flags.Value&1)!=0?0:1;snapshot.station=kind==0?"INTERACTIVE":"NONINTERACTIVE";}
   AddRights(snapshot,restricted,station,kind);AddRights(snapshot,restricted,desktop,2);
   snapshot.stationLabel=ReadLabel(station);snapshot.desktopLabel=ReadLabel(desktop);return snapshot;
  }
  static void EmitLabel(string name,Label value){Console.Out.WriteLine("HOSTED_UI_LABEL name="+name+" available="+(value.available?"true":"false")+" label="+value.label+" no_write_up="+(value.noWriteUp?"true":"false")+" no_read_up="+(value.noReadUp?"true":"false")+" no_execute_up="+(value.noExecuteUp?"true":"false")+" class="+value.failureClass);}
  public static void EmitFixed(IntPtr restricted){
   try{
    Snapshot snapshot=InspectCurrent(restricted);Console.Out.WriteLine("HOSTED_UI_CONTEXT station="+snapshot.station);
    foreach(Result result in snapshot.rights)Console.Out.WriteLine("HOSTED_UI_ACCESS_PROBE name="+result.name+" available="+(result.available?"true":"false")+" allowed="+(result.allowed?"true":"false")+" class="+result.failureClass);
    EmitLabel("WINDOW_STATION",snapshot.stationLabel);EmitLabel("DESKTOP",snapshot.desktopLabel);
   }catch{try{Console.Out.WriteLine("HOSTED_UI_CONTEXT station=UNAVAILABLE");}catch{}}
  }
 }
// END_READ_ONLY_USER_OBJECT_PROBE

// BEGIN_READ_ONLY_KERNEL_POLICY_PROBE
 // Microsoft primary references; queries only, no mutation or new child process.
 // https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-queryinformationjobobject
 // https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_ui_restrictions
 // https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocessmitigationpolicy
 // https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-getkernelobjectsecurity
 // https://learn.microsoft.com/en-us/windows/win32/procthread/process-security-and-access-rights
 // https://learn.microsoft.com/en-us/windows/win32/procthread/thread-security-and-access-rights
 public static class RestrictedKernelPolicyProbe {
  const int Limit=65536,MaxAces=1024;
  [StructLayout(LayoutKind.Sequential)] struct Mapping {public uint Read,Write,Execute,All;}
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool member);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int kind,out uint flags,uint length,out uint needed);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessMitigationPolicy(IntPtr process,int kind,out uint flags,UIntPtr length);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetKernelObjectSecurity(IntPtr handle,uint information,IntPtr descriptor,uint length,out uint needed);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool DuplicateToken(IntPtr token,int level,out IntPtr duplicate);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool AccessCheck(IntPtr descriptor,IntPtr token,uint access,ref Mapping mapping,IntPtr privileges,ref uint length,out uint granted,[MarshalAs(UnmanagedType.Bool)] out bool allowed);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
  public sealed class Policy {public string name,failureClass="QUERY_UNAVAILABLE";public bool available,enabled;}
  public sealed class Right {
   public string name,failureClass="PROBE_UNAVAILABLE";public bool available,allowed;
   public Right Block(string value){available=false;allowed=false;failureClass=value;return this;}
  }
  static readonly string[] UiNames={"HANDLES","READ_CLIPBOARD","WRITE_CLIPBOARD","SYSTEM_PARAMETERS","DISPLAY_SETTINGS","GLOBAL_ATOMS","DESKTOP","EXIT_WINDOWS"};
  public static System.Collections.Generic.List<Policy> QueryJob(IntPtr job,bool callerImmediate){
   var result=new System.Collections.Generic.List<Policy>();string failure="QUERY_UNAVAILABLE";uint flags=0;bool available=false;
   try{
    bool query=true;
    if(callerImmediate){bool member;if(!IsProcessInJob(GetCurrentProcess(),IntPtr.Zero,out member)){query=false;}else if(!member){failure="NO_CALLER_JOB";query=false;}}
    else if(job==IntPtr.Zero){failure="HANDLE_UNAVAILABLE";query=false;}
    uint needed;if(query&&QueryInformationJobObject(job,4,out flags,4,out needed)){
     if(needed!=4)failure="SIZE_BOUNDS";else if((flags&~255u)!=0)failure="UNSUPPORTED_POLICY_FLAGS";else{available=true;failure="NONE";}
    }
   }catch{failure="QUERY_UNAVAILABLE";}
   // NULL observes only the caller's immediate job, not all ancestor policies.
   for(int i=0;i<8;i++)result.Add(new Policy{name=(callerImmediate?"CALLER_IMMEDIATE_JOB_UI_":"OWNED_JOB_UI_")+UiNames[i],available=available,enabled=available&&(flags&(1u<<i))!=0,failureClass=failure});
   return result;
  }
  public static System.Collections.Generic.List<Policy> QueryMitigation(IntPtr process){
   var result=new System.Collections.Generic.List<Policy>();uint flags=0;bool available=false;string failure="QUERY_UNAVAILABLE";
   try{if(process==IntPtr.Zero)failure="HANDLE_UNAVAILABLE";else if(GetProcessMitigationPolicy(process,4,out flags,new UIntPtr(4))){if((flags&~15u)!=0)failure="UNSUPPORTED_POLICY_FLAGS";else{available=true;failure="NONE";}}}catch{}
   result.Add(new Policy{name="CHILD_WIN32K_DISABLED",available=available,enabled=available&&(flags&1)!=0,failureClass=failure});
   result.Add(new Policy{name="CHILD_WIN32K_AUDIT",available=available,enabled=available&&(flags&2)!=0,failureClass=failure});return result;
  }
  public static byte[] ReadDescriptor(IntPtr handle,uint information,out string failure){
   failure="HANDLE_UNAVAILABLE";IntPtr memory=IntPtr.Zero;
   try{
    if(handle==IntPtr.Zero||(information!=7&&information!=16))return null;
    uint needed;bool initial=GetKernelObjectSecurity(handle,information,IntPtr.Zero,0,out needed);
    failure="SECURITY_DESCRIPTOR_UNAVAILABLE";if(initial||Marshal.GetLastWin32Error()!=122)return null;
    failure="SECURITY_DESCRIPTOR_BOUNDS";if(needed<20||needed>Limit)return null;
    memory=Marshal.AllocHGlobal((int)needed);uint actual;
    failure="SECURITY_DESCRIPTOR_UNAVAILABLE";if(!GetKernelObjectSecurity(handle,information,memory,needed,out actual))return null;
    failure="SECURITY_DESCRIPTOR_BOUNDS";if(actual<20||actual>needed)return null;
    byte[] raw=new byte[actual];Marshal.Copy(memory,raw,0,(int)actual);failure="NONE";return raw;
   }catch{failure="PROBE_UNAVAILABLE";return null;}finally{if(memory!=IntPtr.Zero)Marshal.FreeHGlobal(memory);}
  }
  static uint[] Bits(int kind){return kind==0?new uint[]{0x400,0x1000,0x10,0x100000}:new uint[]{0x40,8,0x100000};}
  static string[] Names(int kind){return kind==0?new[]{"CHILD_PROCESS_QUERY","CHILD_PROCESS_QUERY_LIMITED","CHILD_PROCESS_VM_READ","CHILD_PROCESS_SYNCHRONIZE"}:new[]{"CHILD_THREAD_QUERY","CHILD_THREAD_GET_CONTEXT","CHILD_THREAD_SYNCHRONIZE"};}
  public static Right CheckDescriptor(IntPtr restricted,byte[] raw,int kind,uint desired){
   var result=new Right();IntPtr descriptor=IntPtr.Zero,token=IntPtr.Zero,privileges=IntPtr.Zero;
   try{
    if(kind<0||kind>1||Array.IndexOf(Bits(kind),desired)<0)return result.Block("UNSUPPORTED_RIGHT");
    if(raw==null||raw.Length<20||raw.Length>Limit)return result.Block("SECURITY_DESCRIPTOR_BOUNDS");
    var sd=new System.Security.AccessControl.RawSecurityDescriptor(raw,0);
    if(sd.Owner==null||sd.Group==null||(sd.DiscretionaryAcl!=null&&sd.DiscretionaryAcl.Count>MaxAces)||(sd.SystemAcl!=null&&sd.SystemAcl.Count>MaxAces))return result.Block("SECURITY_DESCRIPTOR_BOUNDS");
    if(sd.DiscretionaryAcl!=null)foreach(System.Security.AccessControl.GenericAce ace in sd.DiscretionaryAcl){
     if(ace.AceType!=System.Security.AccessControl.AceType.AccessAllowed&&ace.AceType!=System.Security.AccessControl.AceType.AccessDenied)return result.Block("UNSUPPORTED_ACE");
     var known=ace as System.Security.AccessControl.KnownAce;if(known==null)return result.Block("UNSUPPORTED_ACE");
     if((unchecked((uint)known.AccessMask)&0xF0000000u)!=0)return result.Block("UNMAPPED_GENERIC_ACE");
    }
    if(!DuplicateToken(restricted,2,out token))return result.Block("TOKEN_DUPLICATE_FAILED");
    descriptor=Marshal.AllocHGlobal(raw.Length);Marshal.Copy(raw,0,descriptor,raw.Length);privileges=Marshal.AllocHGlobal(Limit);
    // Both desired rights and every accepted ACE are specific: no guessed mapping.
    var mapping=new Mapping();uint length=Limit,granted;bool allowed;
    if(!AccessCheck(descriptor,token,desired,ref mapping,privileges,ref length,out granted,out allowed)||length>Limit)return result.Block("ACCESS_CHECK_UNAVAILABLE");
    result.available=true;result.allowed=allowed;result.failureClass="NONE";return result;
   }catch{return result.Block("PROBE_UNAVAILABLE");}
   finally{
    if(privileges!=IntPtr.Zero)Marshal.FreeHGlobal(privileges);if(descriptor!=IntPtr.Zero)Marshal.FreeHGlobal(descriptor);
    if(token!=IntPtr.Zero&&!CloseHandle(token))result.Block("RESOURCE_RELEASE_FAILED");
   }
  }
  public static System.Collections.Generic.List<Right> InspectRights(IntPtr restricted,IntPtr handle,int kind){
   var result=new System.Collections.Generic.List<Right>();string failure;byte[] raw=ReadDescriptor(handle,7,out failure);uint[] bits=Bits(kind);string[] names=Names(kind);
   for(int i=0;i<bits.Length;i++){Right value=raw==null?new Right().Block(failure):CheckDescriptor(restricted,raw,kind,bits[i]);value.name=names[i];result.Add(value);}return result;
  }
  static void EmitLabel(string name,IntPtr handle){
   string failure;byte[] raw=ReadDescriptor(handle,16,out failure);var value=raw==null?new RestrictedUserObjectProbe.Label().Block(failure):RestrictedUserObjectProbe.ParseLabel(raw);
   Console.Out.WriteLine("HOSTED_KERNEL_LABEL name="+name+" available="+(value.available?"true":"false")+" label="+value.label+" no_write_up="+(value.noWriteUp?"true":"false")+" no_read_up="+(value.noReadUp?"true":"false")+" no_execute_up="+(value.noExecuteUp?"true":"false")+" class="+value.failureClass);
  }
  public static void EmitFixed(IntPtr restricted,IntPtr job,IntPtr process,IntPtr thread){
   try{
    var policies=QueryJob(job,false);policies.AddRange(QueryJob(IntPtr.Zero,true));policies.AddRange(QueryMitigation(process));
    foreach(Policy value in policies)Console.Out.WriteLine("HOSTED_POLICY_PROBE name="+value.name+" available="+(value.available?"true":"false")+" enabled="+(value.enabled?"true":"false")+" class="+value.failureClass);
    var rights=InspectRights(restricted,process,0);rights.AddRange(InspectRights(restricted,thread,1));
    foreach(Right value in rights)Console.Out.WriteLine("HOSTED_KERNEL_ACCESS_PROBE name="+value.name+" available="+(value.available?"true":"false")+" allowed="+(value.allowed?"true":"false")+" class="+value.failureClass);
    EmitLabel("CHILD_PROCESS",process);EmitLabel("CHILD_THREAD",thread);
   }catch{try{Console.Out.WriteLine("HOSTED_POLICY_PROBE name=CHILD_WIN32K_DISABLED available=false enabled=false class=QUERY_UNAVAILABLE");}catch{}}
  }
 }
// END_READ_ONLY_KERNEL_POLICY_PROBE

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
    RestrictedUserObjectProbe.EmitFixed(limited);
    phase="ENVIRONMENT";
    var values=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);string windows=Environment.GetFolderPath(Environment.SpecialFolder.Windows);
    values.Add("GITHUB_ACTIONS","true");values.Add("RUNNER_ENVIRONMENT","github-hosted");values.Add("RUNNER_TEMP",Environment.GetEnvironmentVariable("RUNNER_TEMP"));values.Add("SOURCE_HEAD",Environment.GetEnvironmentVariable("SOURCE_HEAD"));values.Add("SOURCE_TREE",Environment.GetEnvironmentVariable("SOURCE_TREE"));values.Add("SystemRoot",windows);values.Add("TEMP",Path.GetDirectoryName(run));values.Add("TMP",Path.GetDirectoryName(run));values.Add("WINDIR",windows);
    var block=new StringBuilder();foreach(var pair in values){Check(pair.Value!=null&&pair.Value.IndexOf('\0')<0,"invalid fixed environment");block.Append(pair.Key).Append('=').Append(pair.Value).Append('\0');}block.Append('\0');env=Marshal.StringToHGlobalUni(block.ToString());
    Startup startup=new Startup();startup.Size=(uint)Marshal.SizeOf(typeof(Startup));ProcessInfo info;
    phase="JOB_CREATE";
    job=k.CreateJob();phase="JOB_CONFIGURE";k.ConfigureKillOnClose(job);
    phase="PROCESS_CREATE";
    Check(CreateProcessAsUser(limited,exe,new StringBuilder(Quote(exe)+" --hosted-suite "+Quote(run)),IntPtr.Zero,IntPtr.Zero,false,4|0x400|0x08000000,env,package,ref startup,out info),"restricted fixed process creation BLOCKED; no privilege enabling/fallback");
    p=info.Process;t=info.Thread;phase="JOB_ASSIGN";k.Assign(job,p);assigned=true;RestrictedUserObjectProbe.EmitChildFixed(limited,info.Tid);RestrictedKernelPolicyProbe.EmitFixed(limited,job,p,t);HostedLoaderFacts.Emit(token,limited,p,Path.Combine(Path.GetDirectoryName(package),"runtime-pins.json"));DateTime loaderResumeUtc=DateTime.UtcNow;phase="THREAD_RESUME";k.Resume(t);
    phase="PROCESS_WAIT";
    Check(k.Wait(p,120000)==0,"independent whole-suite watchdog expired: BLOCKED");phase="CHILD_RESULT";result=(int)k.ExitCode(p);if(result!=0)Console.WriteLine("HOSTED_BOOTSTRAP_PHASE="+phase);if(result!=0)Console.WriteLine("HOSTED_CHILD_FAILURE class="+ChildExitClass(unchecked((uint)result)));Console.WriteLine("Fixed Medium supervisor exit="+result+"; inspect results.json; missing evidence is BLOCKED");if(result!=0)LoaderEventProbe.Emit(info.Pid,exe,loaderResumeUtc,DateTime.UtcNow);return result;
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
