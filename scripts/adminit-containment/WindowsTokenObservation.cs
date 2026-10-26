using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace MathUniverse.G0 {
 public sealed class TokenObservation {
  public string schema { get; internal set; }
  public string scope { get; internal set; }
  public string apiStatus { get; internal set; }
  public string status { get; internal set; }
  public string code { get; internal set; }
  public string tokenType { get; internal set; }
  public uint? integrityRid { get; internal set; }
  public bool? elevated { get; internal set; }
  public bool? adminEnabled { get; internal set; }
  public string authority { get { return "NONE"; } }
  public bool isolationConfirmed { get { return false; } }
  public bool localExecute { get { return false; } }
  public string admission { get { return "BLOCKED"; } }
 }
 // Pure policy; synthetic tests call only this class, never the adapter.
 public static class TokenPolicy {
  public static TokenObservation Unavailable(string code) {
   string[] codes = { "E_OS", "E_OPEN", "E_QUERY", "E_FORMAT", "E_CHANGED", "E_IMPERSONATION", "E_CLOSE", "E_LOAD", "E_INTERNAL" };
   return new TokenObservation { schema="math.g0.token-api.v1", scope="CURRENT_PROCESS_OBSERVATION", apiStatus="ERROR", status="UNKNOWN", code=Array.IndexOf(codes,code)>=0?code:"E_INTERNAL", tokenType="UNKNOWN" };
  }
  // -1 means malformed/ambiguous admin group evidence; never a non-admin PASS.
  public static int AdminState(uint matches,uint attributes) {
   if(matches>1 || (matches==0 && attributes!=0) || (attributes & ~0x0000001FU)!=0 || ((attributes & 4U)!=0 && (attributes & 16U)!=0))return -1;
   return matches==1 && (attributes & 4U)!=0?1:0;
  }
  public static TokenObservation Evaluate(byte[] sid, uint attributes, uint elevation, uint type, bool admin, bool stable) {
   if (!stable) return Unavailable("E_CHANGED");
   if (sid==null || sid.Length!=12 || sid[0]!=1 || sid[1]!=1 || attributes<32 || (attributes & ~96U)!=0 || (attributes & 32U)==0 || elevation>1 || type!=1) return Unavailable("E_FORMAT");
   for(int i=2;i<7;i++) if(sid[i]!=0) return Unavailable("E_FORMAT");
   if(sid[7]!=16) return Unavailable("E_FORMAT");
   uint rid=BitConverter.ToUInt32(sid,8);
   bool pass=rid==8192 && elevation==0 && !admin;
   return new TokenObservation {schema="math.g0.token-api.v1",scope="CURRENT_PROCESS_OBSERVATION",apiStatus="OK",status=pass?"PASS":"FAIL",code="NONE",tokenType="PRIMARY",integrityRid=rid,elevated=elevation==1,adminEnabled=admin};
  }
 }
 public static class WindowsTokenAdapter {
  const uint TOKEN_QUERY=8;
  const int TokenGroups=2, TokenType=8, TokenStatistics=10, TokenElevation=20, TokenIntegrityLevel=25;
  [StructLayout(LayoutKind.Sequential)] struct SidAttributes { public IntPtr Sid; public uint Attributes; }
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentThread();
  [DllImport("kernel32.dll",SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] static extern bool CloseHandle(IntPtr handle);
  [DllImport("advapi32.dll",SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
  [DllImport("advapi32.dll",SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] static extern bool OpenThreadToken(IntPtr thread,uint access,[MarshalAs(UnmanagedType.Bool)] bool self,out IntPtr token);
  [DllImport("advapi32.dll",SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr buffer,uint size,out uint needed);
  sealed class Blocked : Exception { internal readonly string Code; internal Blocked(string code){Code=code;} }
  sealed class QueryBuffer : IDisposable {
   internal IntPtr Pointer;
   internal readonly int Length;
   internal QueryBuffer(IntPtr token,int kind) {
    uint n; bool first=GetTokenInformation(token,kind,IntPtr.Zero,0,out n);
    if(first || Marshal.GetLastWin32Error()!=122 || n==0 || n>65536) throw new Blocked("E_QUERY");
    Length=(int)n; Pointer=Marshal.AllocHGlobal(Length);if(Pointer==IntPtr.Zero)throw new Blocked("E_QUERY");
    try {
     for(int i=0;i<Length;i++) Marshal.WriteByte(Pointer,i,0);
     uint actual;
     if(!GetTokenInformation(token,kind,Pointer,n,out actual) || actual!=n) throw new Blocked("E_QUERY");
    } catch { Dispose(); throw; }
   }
   public void Dispose(){if(Pointer!=IntPtr.Zero){IntPtr p=Pointer;Pointer=IntPtr.Zero;try{for(int i=0;i<Length;i++)Marshal.WriteByte(p,i,0);}finally{Marshal.FreeHGlobal(p);}}}
  }
  static void CloseOwned(IntPtr handle) {
   try{if(!CloseHandle(handle))throw new Blocked("E_CLOSE");}catch{throw new Blocked("E_CLOSE");}
  }
  static void NoImpersonation() {
   IntPtr threadToken;
   if(OpenThreadToken(GetCurrentThread(),TOKEN_QUERY,true,out threadToken)) {
    if(threadToken==IntPtr.Zero || threadToken==new IntPtr(-1)) throw new Blocked("E_QUERY");
    CloseOwned(threadToken);
    throw new Blocked("E_IMPERSONATION");
   }
   if(Marshal.GetLastWin32Error()!=1008) throw new Blocked("E_QUERY");
  }
  static byte[] Own(List<byte[]> owned,int size) {
   byte[] bytes=new byte[size];try{owned.Add(bytes);return bytes;}catch{Array.Clear(bytes,0,bytes.Length);throw;}
  }
  static byte[] Statistics(IntPtr token,List<byte[]> owned) {
   using(QueryBuffer q=new QueryBuffer(token,TokenStatistics)) {
    // TOKEN_STATISTICS: two LUIDs, LARGE_INTEGER, six DWORDs, ModifiedId LUID.
    if(q.Length!=56) throw new Blocked("E_FORMAT");
    byte[] result=Own(owned,16);Marshal.Copy(q.Pointer,result,0,8);Marshal.Copy(IntPtr.Add(q.Pointer,48),result,8,8);return result;
   }
  }
  static byte[] CurrentStatistics(List<byte[]> owned) {
   IntPtr current;
   if(!OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,out current) || current==IntPtr.Zero || current==new IntPtr(-1))throw new Blocked("E_OPEN");
   try {return Statistics(current,owned);}finally{CloseOwned(current);}
  }
  static uint Dword(IntPtr token,int kind) {
   using(QueryBuffer q=new QueryBuffer(token,kind)){if(q.Length!=4)throw new Blocked("E_FORMAT");return unchecked((uint)Marshal.ReadInt32(q.Pointer));}
  }
  static byte[] Integrity(IntPtr token,List<byte[]> owned,out uint attributes) {
   using(QueryBuffer q=new QueryBuffer(token,TokenIntegrityLevel)) {
    int header=Marshal.SizeOf(typeof(SidAttributes));
    if(q.Length<header+12)throw new Blocked("E_FORMAT");
    IntPtr sid=Marshal.ReadIntPtr(q.Pointer);
    long offset;
    try {offset=checked(sid.ToInt64()-q.Pointer.ToInt64());}catch{throw new Blocked("E_FORMAT");}
    // Never dereference a SID pointer outside the returned, fully bounded buffer.
    if(offset<header || offset>q.Length-12)throw new Blocked("E_FORMAT");
    attributes=unchecked((uint)Marshal.ReadInt32(q.Pointer,IntPtr.Size));
    byte[] bytes=Own(owned,12);Marshal.Copy(sid,bytes,0,12);return bytes;
   }
  }
  static bool AdminMembership(IntPtr token) {
   using(QueryBuffer q=new QueryBuffer(token,TokenGroups)) {
    int header=IntPtr.Size==8?8:4,entrySize=Marshal.SizeOf(typeof(SidAttributes));
    if(q.Length<header)throw new Blocked("E_FORMAT");
    uint count=unchecked((uint)Marshal.ReadInt32(q.Pointer));
    if(count>1024 || header+(long)count*entrySize>q.Length)throw new Blocked("E_FORMAT");
    long tableEnd=header+(long)count*entrySize;uint matches=0,adminAttributes=0;
    for(int i=0;i<(int)count;i++) {
     int entry=header+i*entrySize;IntPtr sid=Marshal.ReadIntPtr(q.Pointer,entry);long offset;
     try{offset=checked(sid.ToInt64()-q.Pointer.ToInt64());}catch{throw new Blocked("E_FORMAT");}
     if(offset<tableEnd || offset>q.Length-8)throw new Blocked("E_FORMAT");
     byte revision=Marshal.ReadByte(sid),subCount=Marshal.ReadByte(sid,1);
     if(revision!=1 || subCount<1 || subCount>15 || offset+8+4*subCount>q.Length)throw new Blocked("E_FORMAT");
     bool authorityFive=true;for(int j=2;j<7;j++)if(Marshal.ReadByte(sid,j)!=0)authorityFive=false;
     if(Marshal.ReadByte(sid,7)!=5)authorityFive=false;
     if(authorityFive && subCount==2 && Marshal.ReadInt32(sid,8)==32 && Marshal.ReadInt32(sid,12)==544) {
      matches++;adminAttributes=unchecked((uint)Marshal.ReadInt32(q.Pointer,entry+IntPtr.Size));
     }
    }
    int state=TokenPolicy.AdminState(matches,adminAttributes);if(state<0)throw new Blocked("E_FORMAT");return state==1;
   }
  }
  public static TokenObservation Observe() {
   if(Environment.OSVersion.Platform!=PlatformID.Win32NT)return TokenPolicy.Unavailable("E_OS");
   IntPtr token=IntPtr.Zero;var owned=new List<byte[]>(4);TokenObservation result=TokenPolicy.Unavailable("E_INTERNAL");
   try {
    NoImpersonation();
    if(!OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,out token) || token==IntPtr.Zero || token==new IntPtr(-1))throw new Blocked("E_OPEN");
    byte[] before=Statistics(token,owned);uint attributes;byte[] sid=Integrity(token,owned,out attributes);
    uint elevation=Dword(token,TokenElevation),type=Dword(token,TokenType);bool admin=AdminMembership(token);
    NoImpersonation();byte[] after=Statistics(token,owned),current=CurrentStatistics(owned);NoImpersonation();bool stable=true;
    for(int i=0;i<before.Length;i++)if(before[i]!=after[i] || before[i]!=current[i])stable=false;
    result=TokenPolicy.Evaluate(sid,attributes,elevation,type,admin,stable);
   } catch(Blocked e) {result=TokenPolicy.Unavailable(e.Code);} catch {result=TokenPolicy.Unavailable("E_INTERNAL");}
   finally {
    bool cleanupFailed=false;foreach(byte[] bytes in owned){try{Array.Clear(bytes,0,bytes.Length);}catch{cleanupFailed=true;}}
    try{if(token!=IntPtr.Zero && token!=new IntPtr(-1))CloseOwned(token);}
    catch{result=TokenPolicy.Unavailable("E_CLOSE");}
    if(cleanupFailed && result.code!="E_CLOSE")result=TokenPolicy.Unavailable("E_INTERNAL");
   }
   return result;
  }
 }
}
