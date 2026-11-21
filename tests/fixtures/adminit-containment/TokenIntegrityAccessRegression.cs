// Standalone regression: only unassigned restricted copies of our own token.
// Never launch/impersonate/assign a token, enable privileges, or change policy.
using System;
using System.Runtime.InteropServices;
public static class MathTokenAccessRegression {
 [StructLayout(LayoutKind.Sequential)] struct Label {public IntPtr Sid;public uint Attributes;}
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr handle);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool CreateRestrictedToken(IntPtr token,uint flags,uint disable,IntPtr sids,uint delete,IntPtr privileges,uint restrict,IntPtr restrictions,out IntPtr result);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool ConvertStringSidToSid(string text,out IntPtr sid);
 [DllImport("advapi32.dll")] static extern uint GetLengthSid(IntPtr sid);
 [DllImport("advapi32.dll")] static extern IntPtr GetSidSubAuthorityCount(IntPtr sid);
 [DllImport("advapi32.dll")] static extern IntPtr GetSidSubAuthority(IntPtr sid,uint index);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr info,uint size,out uint needed);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool SetTokenInformation(IntPtr token,int kind,IntPtr info,uint size);
 static void Need(bool value){if(!value)throw new InvalidOperationException("OWN_TOKEN_ACCESS_REGRESSION_FAILED");}
 static uint Integrity(IntPtr token){
  uint size;Need(!GetTokenInformation(token,25,IntPtr.Zero,0,out size)&&Marshal.GetLastWin32Error()==122&&size>=IntPtr.Size&&size<=4096);
  IntPtr buffer=Marshal.AllocHGlobal((int)size);
  try{
   uint actual;Need(GetTokenInformation(token,25,buffer,size,out actual)&&actual<=size);
   IntPtr sid=Marshal.ReadIntPtr(buffer);long offset=sid.ToInt64()-buffer.ToInt64();
   Need(offset>=IntPtr.Size&&offset+8<=actual);uint length=GetLengthSid(sid);Need(offset+length<=actual);
   byte count=Marshal.ReadByte(GetSidSubAuthorityCount(sid));Need(count>0);
   return unchecked((uint)Marshal.ReadInt32(GetSidSubAuthority(sid,(uint)count-1)));
  }finally{Marshal.FreeHGlobal(buffer);}
 }
 public sealed class Result {
  public int oldError;public bool productionSuccess;public uint restrictedIntegrity;public bool callerUnchanged,handlesClosed;public int processesCreated=0,tokensAssigned=0;
 }
 public static Result Run(uint productionAccess){
  IntPtr original=IntPtr.Zero,old=IntPtr.Zero,adjustable=IntPtr.Zero,copy=IntPtr.Zero,sid=IntPtr.Zero,label=IntPtr.Zero;
  Result result=new Result();bool closed=true;
  try{
   Need(OpenProcessToken(GetCurrentProcess(),11,out original));uint before=Integrity(original);
   // Refuse Low callers: this regression never attempts to raise integrity.
   Need(before>=8192&&(productionAccess==11||productionAccess==(11|0x80)));
   Need(CreateRestrictedToken(original,5,0,IntPtr.Zero,0,IntPtr.Zero,0,IntPtr.Zero,out old));
   Need(ConvertStringSidToSid("S-1-16-8192",out sid));
   label=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(Label)));Marshal.StructureToPtr(new Label{Sid=sid,Attributes=0x20},label,false);
   uint bytes=(uint)Marshal.SizeOf(typeof(Label))+GetLengthSid(sid);
   bool previous=SetTokenInformation(old,25,label,bytes);result.oldError=Marshal.GetLastWin32Error();Need(!previous&&result.oldError==5);
   Need(OpenProcessToken(GetCurrentProcess(),productionAccess,out adjustable));
   Need(CreateRestrictedToken(adjustable,5,0,IntPtr.Zero,0,IntPtr.Zero,0,IntPtr.Zero,out copy));
   result.productionSuccess=SetTokenInformation(copy,25,label,bytes);
   if(result.productionSuccess){result.restrictedIntegrity=Integrity(copy);Need(result.restrictedIntegrity==8192);}
   result.callerUnchanged=Integrity(original)==before;Need(result.callerUnchanged);
  }finally{
   foreach(IntPtr handle in new[]{original,old,adjustable,copy})if(handle!=IntPtr.Zero)closed=CloseHandle(handle)&&closed;
   if(sid!=IntPtr.Zero)closed=(LocalFree(sid)==IntPtr.Zero)&&closed;
   if(label!=IntPtr.Zero)Marshal.FreeHGlobal(label);
   Need(closed);result.handlesClosed=true;
  }
  return result;
 }
}
