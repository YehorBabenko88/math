// Only memory security descriptors and borrowed current user-object handles.
public static class OwnUserObjectAccessRegression {
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr GetProcessWindowStation();
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr GetThreadDesktop(uint thread);
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool GetUserObjectInformation(IntPtr handle,int index,IntPtr data,uint length,out uint needed);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool CreateRestrictedToken(IntPtr token,uint flags,uint disable,IntPtr sids,uint delete,IntPtr privileges,uint restrict,IntPtr restrictions,out IntPtr result);
 [StructLayout(LayoutKind.Sequential)] struct Mapping {public uint Read,Write,Execute,All;}
 [DllImport("advapi32.dll")] static extern void MapGenericMask(ref uint access,ref Mapping mapping);
 static string stage="SETUP";
 static void Need(bool value){if(!value)throw new InvalidOperationException("OWN_USER_OBJECT_REGRESSION_FAILED phase="+stage);}
 static byte[] Descriptor(System.Security.Principal.SecurityIdentifier user,bool caller,uint access,int count=1){
  var acl=new System.Security.AccessControl.RawAcl(2,count);
  var sid=caller?user:new System.Security.Principal.SecurityIdentifier("S-1-5-32-544");
  for(int index=0;index<count;index++)acl.InsertAce(index,new System.Security.AccessControl.CommonAce(System.Security.AccessControl.AceFlags.None,System.Security.AccessControl.AceQualifier.AccessAllowed,unchecked((int)access),sid,false,null));
  var sd=new System.Security.AccessControl.RawSecurityDescriptor(System.Security.AccessControl.ControlFlags.SelfRelative|System.Security.AccessControl.ControlFlags.DiscretionaryAclPresent,user,user,null,acl);
  byte[] raw=new byte[sd.BinaryLength];sd.GetBinaryForm(raw,0);return raw;
 }
 static byte[] LabelBytes(){
  byte[] raw=new byte[48];raw[0]=1;Array.Copy(BitConverter.GetBytes((ushort)0x8010),0,raw,2,2);Array.Copy(BitConverter.GetBytes(20u),0,raw,12,4);
  raw[20]=2;Array.Copy(BitConverter.GetBytes((ushort)28),0,raw,22,2);Array.Copy(BitConverter.GetBytes((ushort)1),0,raw,24,2);
  raw[28]=17;Array.Copy(BitConverter.GetBytes((ushort)20),0,raw,30,2);Array.Copy(BitConverter.GetBytes(1u),0,raw,32,4);
  raw[36]=1;raw[37]=1;raw[43]=16;Array.Copy(BitConverter.GetBytes(8192u),0,raw,44,4);return raw;
 }
 static bool ValidBorrowed(IntPtr handle){
  IntPtr memory=Marshal.AllocHGlobal(12);try{uint needed;return handle!=IntPtr.Zero&&GetUserObjectInformation(handle,1,memory,12,out needed)&&needed==12;}finally{Marshal.FreeHGlobal(memory);}
 }
 public sealed class Result {public int checks,hostObjectsCreated=0,hostAclsChanged=0;public bool mappingsCorrect=true,boundsRejected,labelParserBounded,borrowedHandlesPreserved,duplicateHandlesClosed;}
 public static Result Run(){
  IntPtr original=IntPtr.Zero,restricted=IntPtr.Zero;var result=new Result();
  try{
   stage="TOKEN_SETUP";Need(OpenProcessToken(GetCurrentProcess(),10,out original));Need(CreateRestrictedToken(original,5,0,IntPtr.Zero,0,IntPtr.Zero,0,IntPtr.Zero,out restricted));
   System.Security.Principal.SecurityIdentifier user;using(var identity=System.Security.Principal.WindowsIdentity.GetCurrent()){user=identity.User;}
   uint[][] expected={new uint[]{0x20303,0x2001C,0x20060,0xF037F},new uint[]{0x20103,0x2000C,0x20060,0xF016F},new uint[]{0x20041,0x200BE,0x20100,0xF01FF}};
   for(int kind=0;kind<3;kind++){
    uint[] mapping=RestrictedUserObjectProbe.MappingValues(kind);Need(mapping.Length==4);for(int index=0;index<4;index++)result.mappingsCorrect&=mapping[index]==expected[kind][index];
    // Object creation maps generic ACE masks before AccessCheck sees the SD.
    uint mapped=0x10000000;var nativeMapping=new Mapping{Read=expected[kind][0],Write=expected[kind][1],Execute=expected[kind][2],All=expected[kind][3]};MapGenericMask(ref mapped,ref nativeMapping);Need(mapped==expected[kind][3]);
    byte[] admin=Descriptor(user,false,mapped),caller=Descriptor(user,true,mapped);
    uint[] bits=kind==2?new uint[]{1,2,4,8,0x10,0x20,0x40,0x80,0x100,0x10000000}:new uint[]{1,2,4,8,0x10,0x20,0x40,0x100,0x200,0x10000000};
    foreach(uint desired in bits){
     stage="ACCESS_"+kind+"_"+desired.ToString("X");
     var denied=RestrictedUserObjectProbe.CheckDescriptor(restricted,admin,kind,desired);var allowed=RestrictedUserObjectProbe.CheckDescriptor(restricted,caller,kind,desired);
     stage+="_D"+denied.available+"_"+denied.allowed+"_"+denied.failureClass+"_A"+allowed.available+"_"+allowed.allowed+"_"+allowed.failureClass;
     Need(denied.available&&allowed.available&&denied.failureClass=="NONE"&&allowed.failureClass=="NONE"&&!denied.allowed);
     bool expectedGrant=desired==0x10000000||(mapping[3]&desired)==desired;Need(allowed.allowed==expectedGrant);result.checks+=2;
    }
   }
   stage="DESCRIPTOR_BOUNDS";result.boundsRejected=!RestrictedUserObjectProbe.CheckDescriptor(restricted,new byte[65537],0,1).available&&!RestrictedUserObjectProbe.CheckDescriptor(restricted,Descriptor(user,true,0xF037F,1025),0,1).available;
   stage="LABEL_BOUNDS";byte[] label=LabelBytes();var parsed=RestrictedUserObjectProbe.ParseLabel(label);byte[] badOffset=(byte[])label.Clone();Array.Copy(BitConverter.GetBytes(0xFFFFFFF0u),0,badOffset,12,4);
   byte[] badCount=(byte[])label.Clone();Array.Copy(BitConverter.GetBytes((ushort)1025),0,badCount,24,2);
   byte[] badSize=(byte[])label.Clone();Array.Copy(BitConverter.GetBytes((ushort)65535),0,badSize,30,2);
   result.labelParserBounded=parsed.available&&parsed.label=="MEDIUM"&&parsed.noWriteUp&&!parsed.noReadUp&&!parsed.noExecuteUp&&!RestrictedUserObjectProbe.ParseLabel(badOffset).available&&!RestrictedUserObjectProbe.ParseLabel(badCount).available&&!RestrictedUserObjectProbe.ParseLabel(badSize).available;
   stage="BORROWED_HANDLES";IntPtr station=GetProcessWindowStation(),desktop=GetThreadDesktop(GetCurrentThreadId());Need(ValidBorrowed(station)&&ValidBorrowed(desktop));
   var snapshot=RestrictedUserObjectProbe.InspectCurrent(restricted);Need(snapshot.rights.Count==20);
   result.borrowedHandlesPreserved=station==GetProcessWindowStation()&&desktop==GetThreadDesktop(GetCurrentThreadId())&&ValidBorrowed(station)&&ValidBorrowed(desktop);
   Need(result.mappingsCorrect&&result.boundsRejected&&result.labelParserBounded&&result.borrowedHandlesPreserved);
  }finally{bool closed=true;foreach(IntPtr handle in new[]{restricted,original})if(handle!=IntPtr.Zero)closed=CloseHandle(handle)&&closed;Need(closed);result.duplicateHandlesClosed=true;}
  return result;
 }
}
