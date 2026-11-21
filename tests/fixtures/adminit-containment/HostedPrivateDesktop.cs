// NON_QUALIFYING fresh-object helper. No arbitrary application launch capability.
namespace MathUniverse.AdminitHosted {
 using System;using System.Text;using System.Text.RegularExpressions;using System.Collections.Generic;using System.Runtime.InteropServices;
 public interface IPrivateDesktopApi {
  string AdmitToken(IntPtr token);IntPtr ParentStation();IntPtr ParentDesktop();
  IntPtr CreateStation(string name,string sid,uint flags,bool inherit);IntPtr CreateDesktop(string name,string sid,uint flags,bool inherit);
  bool SecureAndVerify(IntPtr handle,string sid,bool desktop,string name);bool SetStation(IntPtr station);bool SetDesktop(IntPtr desktop);bool CloseDesktop(IntPtr desktop);bool CloseStation(IntPtr station);
 }
 public sealed class PrivateDesktopException:Exception {public readonly bool CleanupConfirmed,MustExitOwner;public PrivateDesktopException(bool cleanup):base("PRIVATE_DESKTOP_UNAVAILABLE"){CleanupConfirmed=cleanup;MustExitOwner=!cleanup;}}
 public sealed class OwnedPrivateDesktop {
  readonly IPrivateDesktopApi api;readonly IntPtr station,desktop;readonly string name;bool closed,poisoned;
  internal OwnedPrivateDesktop(IPrivateDesktopApi api,IntPtr station,IntPtr desktop,string name){this.api=api;this.station=station;this.desktop=desktop;this.name=name;}
  public string DesktopName{get{if(closed||poisoned)throw new PrivateDesktopException(false);return name;}}
  public bool CleanupConfirmed{get{return closed&&!poisoned;}}
  public bool CloseAfterChildEmpty(bool confirmed){
   if(poisoned)return false;if(closed)return true;if(!confirmed){poisoned=true;return false;}
   try{if(!api.CloseDesktop(desktop)){poisoned=true;return false;}if(!api.CloseStation(station)){poisoned=true;return false;}closed=true;return true;}catch{poisoned=true;return false;}
  }
 }
 public static class HostedPrivateDesktop {
  // Context consistency and fixed office deny-list only, NOT host attestation.
  // The external owner/phase gate is still mandatory. This predicate is pure.
  public static bool IsHostedContext(string actions,string environment,string os,string repository,string run,string attempt,string machine){
   if(actions!="true"||environment!="github-hosted"||os!="Windows"||repository!="YehorBabenko88/math"||!PositiveCounter(run)||!PositiveCounter(attempt)||machine==null||machine.Length>128)return false;
   string name=machine.Trim();if(!Regex.IsMatch(name,@"\A[A-Za-z0-9][A-Za-z0-9_-]{0,62}\z"))return false;
   name=name.Replace("-","").Replace("_","").ToUpperInvariant();
   foreach(string denied in new[]{"ADMINIT","AMINIT","LS5","LS7","PC1","PC2","PC3","PC4","EASY","LEITSTELLE1","LS03E","LS4","LS07"})if(name==denied)return false;
   return true;
  }
  static bool PositiveCounter(string value){if(value==null||value.Length==0||value.Length>20)return false;foreach(char c in value)if(c<'0'||c>'9')return false;ulong parsed;return UInt64.TryParse(value,System.Globalization.NumberStyles.None,System.Globalization.CultureInfo.InvariantCulture,out parsed)&&parsed>0;}
  internal static IPrivateDesktopApi GuardNative(bool admitted,Func<IPrivateDesktopApi> create){if(!admitted)throw new PrivateDesktopException(true);return create();}
  static void Need(bool value){if(!value)throw new InvalidOperationException();}
  static bool Safe(Func<bool> action){try{return action();}catch{return false;}}
  // Fresh disposable diagnostic process and GUI-free calling thread only. Caller
  // must EXIT that owner on MustExitOwner, never continue another probe. Native
  // calls are synchronous; the separate existing owner watchdog remains required.
  // Account-private, NOT PID-only or hostile same-user/administrator containment.
  public static OwnedPrivateDesktop Create(IntPtr limitedToken,IPrivateDesktopApi api=null){
   // Fail before constructing the production backend or creating any USER object.
   // Injected typed fakes remain available offline and never imply native proof.
   if(api==null)api=GuardNative(IsHostedContext(Environment.GetEnvironmentVariable("GITHUB_ACTIONS"),Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT"),Environment.GetEnvironmentVariable("RUNNER_OS"),Environment.GetEnvironmentVariable("GITHUB_REPOSITORY"),Environment.GetEnvironmentVariable("GITHUB_RUN_ID"),Environment.GetEnvironmentVariable("GITHUB_RUN_ATTEMPT"),Environment.MachineName),()=>new NativePrivateDesktopApi());
   IntPtr originalStation=IntPtr.Zero,originalDesktop=IntPtr.Zero,station=IntPtr.Zero,desktop=IntPtr.Zero;bool success=false,attempted=false,returned=false,desktopAttempted=false,desktopReturned=false,unknown=false,restored=true;string user=null,stationName="MathDiag_"+Guid.NewGuid().ToString("N"),desktopName="Probe_"+Guid.NewGuid().ToString("N");
   try{
    Need(limitedToken!=IntPtr.Zero);user=api.AdmitToken(limitedToken);Need(user!=null&&user.Length<=184&&Regex.IsMatch(user,@"\AS-1-[0-9]+(?:-[0-9]+){1,15}\z"));
    originalStation=api.ParentStation();originalDesktop=api.ParentDesktop();Need(originalStation!=IntPtr.Zero&&originalDesktop!=IntPtr.Zero);
    Need(api.AdmitToken(limitedToken)==user);attempted=true;IntPtr candidate=api.CreateStation(stationName,user,1,false);returned=true;
    if(candidate==originalStation||candidate==originalDesktop){unknown=true;Need(false);}station=candidate;Need(station!=IntPtr.Zero);
    Need(api.SecureAndVerify(station,user,false,stationName));Need(api.SetStation(station));Need(api.AdmitToken(limitedToken)==user);
    desktopAttempted=true;candidate=api.CreateDesktop(desktopName,user,0,false);desktopReturned=true;if(candidate==originalDesktop||candidate==originalStation||candidate==station){unknown=true;Need(false);}desktop=candidate;Need(desktop!=IntPtr.Zero);
    Need(api.SecureAndVerify(desktop,user,true,desktopName));success=true;
   }catch(Exception error){var reported=error as PrivateDesktopException;if(reported!=null&&!reported.CleanupConfirmed)unknown=true;if(attempted&&!returned||desktopAttempted&&!desktopReturned)unknown=true;}
   finally{
    // Borrowed handles are restored only, NEVER closed or security-mutated.
    if(attempted&&(station!=IntPtr.Zero||unknown))restored=Safe(()=>api.SetStation(originalStation))&&Safe(()=>api.SetDesktop(originalDesktop));
   }
   if(success&&restored&&!unknown)return new OwnedPrivateDesktop(api,station,desktop,stationName+"\\"+desktopName);
   bool cleanup=restored&&!unknown;
   if(cleanup&&desktop!=IntPtr.Zero)cleanup=Safe(()=>api.CloseDesktop(desktop));
   if(cleanup&&station!=IntPtr.Zero)cleanup=Safe(()=>api.CloseStation(station));
   throw new PrivateDesktopException(cleanup);
  }
 }
 // All production security mutations below target ONLY freshly owned handles.
 // No privilege adjustment, token/session change, logon, existing-object ACL
 // mutation, interactive switching or arbitrary child launch exists in this API.
 sealed class NativePrivateDesktopApi:IPrivateDesktopApi {
  const uint StationAccess=0x000f037f,DesktopAccess=0x000f01ff;const string SystemSid="S-1-5-18";
  [StructLayout(LayoutKind.Sequential)] struct SecurityAttributes{public uint Length;public IntPtr Descriptor;public int Inherit;}
  [StructLayout(LayoutKind.Sequential)] struct UserFlags{public int Inherit,Reserved;public uint Flags;}
  [DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll")]static extern uint GetCurrentThreadId();
  [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll")]static extern IntPtr LocalFree(IntPtr value);
  [DllImport("advapi32.dll",SetLastError=true)]static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
  [DllImport("advapi32.dll",SetLastError=true)]static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr buffer,uint length,out uint needed);
  [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool ConvertStringSidToSid(string text,out IntPtr sid);
  [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool ConvertSidToStringSid(IntPtr sid,out IntPtr text);
  [DllImport("advapi32.dll")]static extern bool IsValidSid(IntPtr sid);
  [DllImport("advapi32.dll")]static extern uint GetLengthSid(IntPtr sid);
  [DllImport("advapi32.dll",SetLastError=true)]static extern bool CheckTokenMembership(IntPtr token,IntPtr sid,out bool member);
  [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string text,uint revision,out IntPtr descriptor,out uint size);
  [DllImport("advapi32.dll")]static extern bool GetSecurityDescriptorSacl(IntPtr descriptor,out bool present,out IntPtr sacl,out bool defaulted);
  [DllImport("advapi32.dll")]static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
  [DllImport("advapi32.dll")]static extern bool GetSecurityDescriptorControl(IntPtr descriptor,out ushort control,out uint revision);
  [DllImport("advapi32.dll")]static extern bool GetAce(IntPtr acl,uint index,out IntPtr ace);
  [DllImport("advapi32.dll")]static extern uint SetSecurityInfo(IntPtr handle,int type,uint information,IntPtr owner,IntPtr group,IntPtr dacl,IntPtr sacl);
  [DllImport("advapi32.dll")]static extern uint GetSecurityInfo(IntPtr handle,int type,uint information,out IntPtr owner,out IntPtr group,out IntPtr dacl,out IntPtr sacl,out IntPtr descriptor);
  [DllImport("user32.dll",EntryPoint="CreateWindowStationW",ExactSpelling=true,CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateWindowStation(string name,uint flags,uint access,ref SecurityAttributes security);
  [DllImport("user32.dll",EntryPoint="CreateDesktopW",ExactSpelling=true,CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr MakeDesktop(string name,IntPtr device,IntPtr mode,uint flags,uint access,ref SecurityAttributes security);
  [DllImport("user32.dll",SetLastError=true)]static extern IntPtr GetProcessWindowStation();
  [DllImport("user32.dll",SetLastError=true)]static extern IntPtr GetThreadDesktop(uint thread);
  [DllImport("user32.dll",SetLastError=true)]static extern bool SetProcessWindowStation(IntPtr station);
  [DllImport("user32.dll",SetLastError=true)]static extern bool SetThreadDesktop(IntPtr desktop);
  [DllImport("user32.dll",EntryPoint="CloseDesktop",ExactSpelling=true,SetLastError=true)]static extern bool ReleaseDesktop(IntPtr desktop);
  [DllImport("user32.dll",EntryPoint="CloseWindowStation",ExactSpelling=true,SetLastError=true)]static extern bool ReleaseStation(IntPtr station);
  [DllImport("user32.dll",EntryPoint="GetUserObjectInformationW",ExactSpelling=true,CharSet=CharSet.Unicode,SetLastError=true)]static extern bool ObjectName(IntPtr handle,int index,StringBuilder value,uint length,out uint needed);
  [DllImport("user32.dll",EntryPoint="GetUserObjectInformationW",ExactSpelling=true,SetLastError=true)]static extern bool ObjectFlags(IntPtr handle,int index,out UserFlags value,uint length,out uint needed);
  static void Need(bool value){if(!value)throw new InvalidOperationException();}
  static void Free(IntPtr value){if(value!=IntPtr.Zero&&LocalFree(value)!=IntPtr.Zero)throw new PrivateDesktopException(false);}
  static bool InRange(IntPtr root,uint size,IntPtr value,uint count){long offset=value.ToInt64()-root.ToInt64();return value!=IntPtr.Zero&&offset>=0&&count<=size&&offset<=size-count;}
  static bool BoundedSid(IntPtr root,uint length,IntPtr sid){if(!InRange(root,length,sid,8)||Marshal.ReadByte(sid)!=1)return false;uint count=Marshal.ReadByte(sid,1),bytes=8+4*count;return count<=15&&InRange(root,length,sid,bytes)&&IsValidSid(sid)&&GetLengthSid(sid)==bytes;}
  static string Sid(IntPtr sid){Need(IsValidSid(sid));uint size=GetLengthSid(sid);Need(size>=8&&size<=68);IntPtr text;Need(ConvertSidToStringSid(sid,out text));try{string value=Marshal.PtrToStringUni(text);Need(value!=null&&value.Length<=184);return value;}finally{Free(text);}}
  static string TokenSid(IntPtr token,int kind){uint size;GetTokenInformation(token,kind,IntPtr.Zero,0,out size);Need(size>=IntPtr.Size+4&&size<=4096);IntPtr memory=Marshal.AllocHGlobal((int)size);try{uint actual;Need(GetTokenInformation(token,kind,memory,size,out actual)&&actual>=IntPtr.Size+4&&actual<=size);IntPtr sid=Marshal.ReadIntPtr(memory);Need(BoundedSid(memory,actual,sid));return Sid(sid);}finally{Marshal.FreeHGlobal(memory);}}
  static uint TokenNumber(IntPtr token,int kind){IntPtr value=Marshal.AllocHGlobal(4);try{uint actual;Need(GetTokenInformation(token,kind,value,4,out actual)&&actual==4);return unchecked((uint)Marshal.ReadInt32(value));}finally{Marshal.FreeHGlobal(value);}}
  // Caller supplies the unchanged flags5 token; this helper never creates or
  // changes a token. Read-only user/Medium/session checks bind object access.
  public string AdmitToken(IntPtr limited){IntPtr current=IntPtr.Zero,administrators=IntPtr.Zero;try{Need(limited!=IntPtr.Zero&&OpenProcessToken(GetCurrentProcess(),8,out current));string user=TokenSid(current,1);Need(user!=SystemSid&&TokenSid(limited,1)==user&&TokenSid(limited,25)=="S-1-16-8192"&&TokenNumber(limited,12)==TokenNumber(current,12));Need(ConvertStringSidToSid("S-1-5-32-544",out administrators));bool member;Need(CheckTokenMembership(IntPtr.Zero,administrators,out member)&&member);return user;}finally{if(administrators!=IntPtr.Zero)Free(administrators);if(current!=IntPtr.Zero&&!CloseHandle(current))throw new PrivateDesktopException(false);}}
  public IntPtr ParentStation(){return GetProcessWindowStation();}public IntPtr ParentDesktop(){return GetThreadDesktop(GetCurrentThreadId());}
  static IntPtr Descriptor(string sid,uint rights){IntPtr value=IntPtr.Zero;bool owned=false;try{uint size;string mask="0x"+rights.ToString("x8");Need(ConvertStringSecurityDescriptorToSecurityDescriptor("O:"+sid+"D:P(A;;"+mask+";;;SY)(A;;"+mask+";;;"+sid+")",1,out value,out size)&&size>=20&&size<=4096);owned=true;return value;}finally{if(!owned)Free(value);}}
  public IntPtr CreateStation(string name,string sid,uint flags,bool inherit){Need(flags==1&&!inherit&&Regex.IsMatch(name,@"\AMathDiag_[a-f0-9]{32}\z"));IntPtr sd=Descriptor(sid,StationAccess);try{var security=new SecurityAttributes{Length=(uint)Marshal.SizeOf(typeof(SecurityAttributes)),Descriptor=sd,Inherit=0};return CreateWindowStation(name,1,StationAccess,ref security);}finally{Free(sd);}}
  public IntPtr CreateDesktop(string name,string sid,uint flags,bool inherit){Need(flags==0&&!inherit&&Regex.IsMatch(name,@"\AProbe_[a-f0-9]{32}\z"));IntPtr sd=Descriptor(sid,DesktopAccess);try{var security=new SecurityAttributes{Length=(uint)Marshal.SizeOf(typeof(SecurityAttributes)),Descriptor=sd,Inherit=0};return MakeDesktop(name,IntPtr.Zero,IntPtr.Zero,0,DesktopAccess,ref security);}finally{Free(sd);}}
  static string Name(IntPtr handle,int kind){uint needed;var value=new StringBuilder(257);Need(ObjectName(handle,kind,value,514,out needed)&&needed>=2&&needed<=514);return value.ToString();}
  static void Medium(IntPtr handle){IntPtr descriptor=IntPtr.Zero;try{uint size;Need(ConvertStringSecurityDescriptorToSecurityDescriptor("S:(ML;;NW;;;ME)",1,out descriptor,out size)&&size>=20&&size<=4096);bool present,defaulted;IntPtr acl;Need(GetSecurityDescriptorSacl(descriptor,out present,out acl,out defaulted)&&present&&acl!=IntPtr.Zero);Need(SetSecurityInfo(handle,7,0x10,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,acl)==0);}finally{if(descriptor!=IntPtr.Zero)Free(descriptor);}}
  static HashSet<string> Aces(IntPtr sd,uint length,IntPtr acl,int expectedCount,byte type,uint mask){Need(InRange(sd,length,acl,8));uint bytes=(ushort)Marshal.ReadInt16(acl,2),count=(ushort)Marshal.ReadInt16(acl,4);Need(bytes>=8&&InRange(sd,length,acl,bytes)&&count==expectedCount);var sids=new HashSet<string>(StringComparer.Ordinal);for(uint i=0;i<count;i++){IntPtr ace;Need(GetAce(acl,i,out ace)&&InRange(acl,bytes,ace,16));uint size=(ushort)Marshal.ReadInt16(ace,2);Need(InRange(acl,bytes,ace,size)&&Marshal.ReadByte(ace)==type&&Marshal.ReadByte(ace,1)==0&&unchecked((uint)Marshal.ReadInt32(ace,4))==mask);IntPtr sid=IntPtr.Add(ace,8);Need(BoundedSid(ace,size,sid)&&size==8+GetLengthSid(sid));Need(sids.Add(Sid(sid)));}return sids;}
  public bool SecureAndVerify(IntPtr handle,string user,bool desktop,string name){Need(Name(handle,2)==name&&Name(handle,3)==(desktop?"Desktop":"WindowStation"));UserFlags flags;uint needed;Need(ObjectFlags(handle,1,out flags,(uint)Marshal.SizeOf(typeof(UserFlags)),out needed)&&needed==(uint)Marshal.SizeOf(typeof(UserFlags))&&flags.Inherit==0&&flags.Reserved==0&&flags.Flags==0);Need(desktop||!String.Equals(name,"WinSta0",StringComparison.OrdinalIgnoreCase));Medium(handle);IntPtr owner,group,dacl,sacl,sd;Need(GetSecurityInfo(handle,7,1|4|0x10,out owner,out group,out dacl,out sacl,out sd)==0&&sd!=IntPtr.Zero);try{uint length=GetSecurityDescriptorLength(sd);Need(length>=20&&length<=4096&&BoundedSid(sd,length,owner)&&Sid(owner)==user);ushort control;uint revision;Need(GetSecurityDescriptorControl(sd,out control,out revision)&&(control&0x1004)==0x1004);var allowed=Aces(sd,length,dacl,2,0,desktop?DesktopAccess:StationAccess);Need(allowed.SetEquals(new[]{user,SystemSid}));Need(Aces(sd,length,sacl,1,0x11,1).SetEquals(new[]{"S-1-16-8192"}));return true;}finally{Free(sd);}}
  public bool SetStation(IntPtr station){return SetProcessWindowStation(station);}public bool SetDesktop(IntPtr desktop){return SetThreadDesktop(desktop);}public bool CloseDesktop(IntPtr desktop){return ReleaseDesktop(desktop);}public bool CloseStation(IntPtr station){return ReleaseStation(station);}
 }
}
