using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
namespace MathUniverse.G0 {
 public static class FakeNative {
  public static string Fault;
  public static int Error, Opens, Closes, Queries, Frees, Stats, Allocs, Threads;
  public static List<byte[]> Arrays=new List<byte[]>();
  public static HashSet<IntPtr> Live=new HashSet<IntPtr>();
  public static HashSet<IntPtr> Memory=new HashSet<IntPtr>();
  public static bool OpenProcessToken(IntPtr p,uint a,out IntPtr t){t=IntPtr.Zero;if(a!=8)throw new Exception();if(Fault=="open" || (Fault=="open-current"&&Opens==1))return false;t=new IntPtr(++Opens);Live.Add(t);return true;}
  public static bool OpenThreadToken(IntPtr p,uint a,bool s,out IntPtr t){t=IntPtr.Zero;Threads++;Error=(Fault=="thread-error"||(Fault=="thread-error-late"&&Threads==2))?5:1008;if((Fault=="impersonation"||Fault=="thread-close"||(Fault=="impersonation-late"&&Threads==3))){t=new IntPtr(99);Live.Add(t);return true;}return false;}
  public static bool CloseHandle(IntPtr t){Closes++;if(!Live.Remove(t))throw new Exception("double close");if(Fault=="close-throw"||(Fault=="close-current-throw"&&t.ToInt64()==2))throw new Exception();return !(Fault=="thread-close"||Fault=="close" || (Fault=="close-current"&&t.ToInt64()==2));}
  public static IntPtr Allocate(int n){Allocs++;if(Fault=="alloc"||(Fault=="alloc-late"&&Allocs==3))throw new OutOfMemoryException();if(Fault=="alloc-zero")return IntPtr.Zero;IntPtr p=Marshal.AllocHGlobal(n);Memory.Add(p);return p;}
  public static void Free(IntPtr p){if(!Memory.Remove(p))throw new Exception("double free");Frees++;Marshal.FreeHGlobal(p);if(Fault=="free")throw new Exception();}
  public static void Clear(byte[] b,int start,int length){Array.Clear(b,start,length);if(Fault=="clear")throw new Exception();}
  public static void Copy(IntPtr p,byte[] b,int start,int length){Marshal.Copy(p,b,start,length);if(Fault=="copy")throw new Exception();}
  public static byte[] Track(byte[] b){Arrays.Add(b);return b;}
  public static bool GetTokenInformation(IntPtr t,int kind,IntPtr p,uint size,out uint n){
   n=(uint)(kind==10?56:kind==25?(IntPtr.Size==8?28:20):kind==2?((IntPtr.Size==8?8:4)+(IntPtr.Size==8?16:8)*((Fault=="group-duplicate"||Fault=="nonadmin-logon")?2:1)+16*((Fault=="group-duplicate"||Fault=="nonadmin-logon")?2:1))+(Fault=="nonadmin-logon"?4:0):4);
   if(Fault=="huge")n=65537;if(Fault=="short")n=1;
   if(Fault=="stats-size"&&kind==10)n=55;
   if(p==IntPtr.Zero){Error=Fault=="query-size"?5:122;return false;}Queries++;
   if(Fault=="query" || (Fault=="query-after-sid"&&kind==20))return false;
   if(size!=n)return false;if(Fault=="query-length"){n++;return true;}
   if(n==1)return true;
   if(kind==10){Stats++;Marshal.WriteInt32(p,7);Marshal.WriteInt32(p,48,Fault=="changed"&&Stats>1?9:8);}
   if(kind==25){int h=IntPtr.Size==8?16:8;Marshal.WriteIntPtr(p,Fault=="pointer"?IntPtr.Add(p,65536):IntPtr.Add(p,h));Marshal.WriteInt32(p,IntPtr.Size,32);byte[] sid={1,1,0,0,0,0,0,16,0,32,0,0};if(Fault=="sid")sid[1]=2;Marshal.Copy(sid,0,IntPtr.Add(p,h),12);}
   if(kind==20)Marshal.WriteInt32(p,Fault=="elevation"?2:0);
   if(kind==8)Marshal.WriteInt32(p,1);
   if(kind==2){int h=IntPtr.Size==8?8:4,e=IntPtr.Size==8?16:8,c=(Fault=="group-duplicate"||Fault=="nonadmin-logon")?2:1;Marshal.WriteInt32(p,Fault=="group-table"?1025:Fault=="admin-absent"?0:c);for(int i=0;i<c;i++){IntPtr sid=IntPtr.Add(p,h+e*c+16*i);Marshal.WriteIntPtr(p,h+e*i,Fault=="admin-null"?IntPtr.Zero:Fault=="group-pointer"?IntPtr.Add(p,65536):sid);Marshal.WriteInt32(p,h+e*i+IntPtr.Size,Fault=="nonadmin-logon"&&i==1?unchecked((int)0xC0000007U):Fault=="admin-reserved"?128:Fault=="admin-logon"?unchecked((int)0xC0000000U):Fault=="admin-enabled"?4:Fault=="group-attrs"?20:16);byte[] data={1,2,0,0,0,0,0,5,32,0,0,0,32,2,0,0};if(Fault=="group-truncated")data[1]=15;if(Fault=="nonadmin-logon"&&i==1)data=new byte[]{1,3,0,0,0,0,0,5,5,0,0,0,123,0,0,0,1,0,0,0};Marshal.Copy(data,0,sid,data.Length);}}
   return true;
  }
  public static void Run(string fault){var type=typeof(WindowsTokenAdapter).GetNestedType("SidAttributes",System.Reflection.BindingFlags.NonPublic);if(IntPtr.Size!=8||Marshal.SizeOf(type)!=16||Marshal.OffsetOf(type,"Attributes").ToInt32()!=8)throw new Exception("ABI");Fault=fault;Error=0;Opens=Closes=Queries=Frees=Stats=Allocs=Threads=0;Arrays.Clear();Live.Clear();Memory.Clear();var r=WindowsTokenAdapter.Observe();
   if(fault=="none" && Arrays.Count!=4)throw new Exception("array tracking");
   if(fault=="query-after-sid" && Arrays.Count!=2)throw new Exception("partial tracking");
   if(fault=="close-current" && Arrays.Count!=4)throw new Exception("helper tracking");
   if(fault=="none" && r.status!="PASS")throw new Exception("baseline");
   if(r.status!=(fault=="none"||fault=="admin-absent"||fault=="nonadmin-logon"?"PASS":fault=="admin-enabled"?"FAIL":"UNKNOWN"))throw new Exception("fault accepted");
   if((fault=="close"||fault=="close-current"||fault=="close-throw"||fault=="close-current-throw"||fault=="thread-close")&&r.code!="E_CLOSE")throw new Exception("cleanup priority");
   if(fault=="changed"&&r.code!="E_CHANGED")throw new Exception("changed code");
   if((fault=="impersonation"||fault=="impersonation-late")&&r.code!="E_IMPERSONATION")throw new Exception("impersonation code");
   if((fault=="sid"||fault=="group-table"||fault=="group-truncated"||fault=="group-duplicate"||fault=="group-attrs"||fault=="admin-reserved"||fault=="admin-logon"||fault=="admin-null")&&r.code!="E_FORMAT")throw new Exception("format code");
   if(r.localExecute||r.isolationConfirmed||r.admission!="BLOCKED")throw new Exception("gate");
   foreach(var b in Arrays)foreach(byte x in b)if(x!=0)throw new Exception("managed cleanup skipped");
   if(Live.Count!=0||Memory.Count!=0)throw new Exception("resource not attempted");
  }
 }
}
