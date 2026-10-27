using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
namespace MathUniverse.G0 {
 public static class FakeNative {
  static readonly Dictionary<string,string> Expected=new Dictionary<string,string> {
   {"none","NONE:NONE:NONE"},
   {"query-after-sid","E_QUERY:Q3:READ"},
   {"close-current","E_CLOSE:Q7:CLOSE"},
   {"open","E_OPEN:OPEN:OPEN"},
   {"open-current","E_OPEN:Q7:OPEN"},
   {"thread-error","E_QUERY:T1:PROBE"},
   {"impersonation","E_IMPERSONATION:T1:IMPERSONATION"},
   {"query","E_QUERY:Q1:READ"},
   {"alloc","E_INTERNAL:Q1:BOUNDS"},
   {"alloc-zero","E_QUERY:Q1:BOUNDS"},
   {"huge","E_QUERY:Q1:BOUNDS"},
   {"short","E_FORMAT:Q1:BOUNDS"},
   {"pointer","E_FORMAT:Q2:BOUNDS"},
   {"sid","E_FORMAT:POLICY:BOUNDS"},
   {"elevation","E_FORMAT:POLICY:BOUNDS"},
   {"changed","E_CHANGED:POLICY:IDENTITY"},
   {"group-table","E_FORMAT:Q5:BOUNDS"},
   {"close","E_CLOSE:CLEANUP:CLOSE"},
   {"query-size","E_QUERY:Q1:PROBE"},
   {"query-length","E_QUERY:Q1:BOUNDS"},
   {"alloc-late","E_INTERNAL:Q3:BOUNDS"},
   {"free","E_INTERNAL:Q1:CLEANUP"},
   {"clear","E_INTERNAL:CLEANUP:CLEANUP"},
   {"copy","E_INTERNAL:Q1:BOUNDS"},
   {"close-throw","E_CLOSE:CLEANUP:CLOSE"},
   {"close-current-throw","E_CLOSE:Q7:CLOSE"},
   {"thread-close","E_CLOSE:T1:CLOSE"},
   {"stats-size","E_FORMAT:Q1:BOUNDS"},
   {"group-pointer","E_FORMAT:Q5:BOUNDS"},
   {"group-duplicate","E_FORMAT:Q5:BOUNDS"},
   {"group-attrs","E_FORMAT:Q5:BOUNDS"},
   {"group-truncated","E_FORMAT:Q5:BOUNDS"},
   {"thread-error-late","E_QUERY:T2:PROBE"},
   {"impersonation-late","E_IMPERSONATION:T3:IMPERSONATION"},
   {"admin-reserved","E_FORMAT:Q5:BOUNDS"},
   {"admin-logon","E_FORMAT:Q5:BOUNDS"},
   {"admin-null","E_FORMAT:Q5:BOUNDS"},
   {"admin-absent","NONE:NONE:NONE"},
   {"admin-enabled","NONE:NONE:NONE"},
   {"nonadmin-logon","NONE:NONE:NONE"}
  };
  public static string Fault;
  public static List<TokenObservation> Results=new List<TokenObservation>();
  static bool ForceCloseFailure;
  static int QueryTarget, ThreadTarget, Probes; static string QueryMode, ThreadMode; static bool Injected;
  public static int Error, Opens, Closes, Queries, Frees, Stats, Allocs, Threads;
  public static List<byte[]> Arrays=new List<byte[]>();
  public static HashSet<IntPtr> Live=new HashSet<IntPtr>();
  public static HashSet<IntPtr> Memory=new HashSet<IntPtr>();
  public static bool OpenProcessToken(IntPtr p,uint a,out IntPtr t){t=IntPtr.Zero;if(a!=8)throw new Exception();if(Fault=="open" || (Fault=="open-current"&&Opens==1))return false;t=new IntPtr(++Opens);Live.Add(t);return true;}
  public static bool OpenThreadToken(IntPtr p,uint a,bool s,out IntPtr t){t=IntPtr.Zero;Threads++;
   if(Threads==ThreadTarget){Injected=true;if(ThreadMode=="error"||ThreadMode=="error-zero"||ThreadMode=="anonymous"){Error=ThreadMode=="error"?5:ThreadMode=="anonymous"?1347:0;return false;}if(ThreadMode=="success-zero")return true;if(ThreadMode=="success-invalid"){t=new IntPtr(-1);return true;}if(ThreadMode=="absent"){Error=1008;return false;}throw new Exception("mode");}
   Error=(Fault=="thread-error"||(Fault=="thread-error-late"&&Threads==2))?5:1008;if((Fault=="impersonation"||Fault=="thread-close"||(Fault=="impersonation-late"&&Threads==3))){t=new IntPtr(99);Live.Add(t);return true;}return false;}
  public static bool CloseHandle(IntPtr t){Closes++;if(!Live.Remove(t))throw new Exception("double close");if(Fault=="close-throw"||(Fault=="close-current-throw"&&t.ToInt64()==2))throw new Exception();return !(ForceCloseFailure||Fault=="thread-close"||Fault=="close" || (Fault=="close-current"&&t.ToInt64()==2));}
  public static IntPtr Allocate(int n){Allocs++;if(Fault=="alloc"||(Fault=="alloc-late"&&Allocs==3))throw new OutOfMemoryException();if(Fault=="alloc-zero"||(Probes==QueryTarget&&QueryMode=="alloc-zero")){Injected=true;return IntPtr.Zero;}IntPtr p=Marshal.AllocHGlobal(n);Memory.Add(p);return p;}
  public static void Free(IntPtr p){if(!Memory.Remove(p))throw new Exception("double free");Frees++;Marshal.FreeHGlobal(p);if(Fault=="free")throw new Exception();}
  public static void Clear(byte[] b,int start,int length){Array.Clear(b,start,length);if(Fault=="clear")throw new Exception();}
  public static void Copy(IntPtr p,byte[] b,int start,int length){Marshal.Copy(p,b,start,length);if(Fault=="copy")throw new Exception();}
  public static byte[] Track(byte[] b){Arrays.Add(b);return b;}
  public static bool GetTokenInformation(IntPtr t,int kind,IntPtr p,uint size,out uint n){
   n=(uint)(kind==10?56:kind==25?(IntPtr.Size==8?28:20):kind==2?((IntPtr.Size==8?8:4)+(IntPtr.Size==8?16:8)*((Fault=="group-duplicate"||Fault=="nonadmin-logon")?2:1)+16*((Fault=="group-duplicate"||Fault=="nonadmin-logon")?2:1))+(Fault=="nonadmin-logon"?4:0):4);
   if(Fault=="huge")n=65537;if(Fault=="short")n=1;
   if(Fault=="stats-size"&&kind==10)n=55;
   if(p==IntPtr.Zero){Probes++;if(Probes==QueryTarget){if(QueryMode.StartsWith("probe-"))Injected=true;if(QueryMode=="probe-success"){Error=122;return true;}if(QueryMode=="probe-error"||QueryMode=="probe-error-zero"){Error=QueryMode=="probe-error"?5:0;return false;}if(QueryMode=="probe-zero"){Error=122;n=0;return false;}if(QueryMode=="probe-huge"){Error=122;n=65537;return false;}}
    Error=Fault=="query-size"?5:122;return false;}Queries++;
   if(Probes==QueryTarget){if(QueryMode.StartsWith("read-"))Injected=true;if(QueryMode=="read-error"||QueryMode=="read-error-other"){Error=QueryMode=="read-error"?122:5;n=size+1;return false;}if(QueryMode=="read-grow"){n=size+1;return true;}if(QueryMode=="read-shrink"){n=size-1;return true;}if(QueryMode=="read-stale-error")Error=5;}
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
  public static void RunCombined(string mode){ForceCloseFailure=true;try{if(mode=="query-close"){QueryTarget=2;QueryMode="read-error";Run("none");if(!Injected)throw new Exception("not injected");}else if(mode=="clear-close")Run("clear");else throw new Exception("mode");}finally{ForceCloseFailure=false;QueryTarget=0;QueryMode=null;}}
  public static void RunQuery(int stage,string mode){QueryTarget=stage;QueryMode=mode;try{Run("none");if(!Injected)throw new Exception("not injected");}finally{QueryTarget=0;QueryMode=null;}}
  public static void RunThread(int stage,string mode){ThreadTarget=stage;ThreadMode=mode;try{Run("none");if(!Injected)throw new Exception("not injected");}finally{ThreadTarget=0;ThreadMode=null;}}
  public static void Run(string fault){var type=typeof(WindowsTokenAdapter).GetNestedType("SidAttributes",System.Reflection.BindingFlags.NonPublic);if(IntPtr.Size!=8||Marshal.SizeOf(type)!=16||Marshal.OffsetOf(type,"Attributes").ToInt32()!=8)throw new Exception("ABI");Fault=fault;Error=0;Probes=0;Injected=false;Opens=Closes=Queries=Frees=Stats=Allocs=Threads=0;Arrays.Clear();Live.Clear();Memory.Clear();var r=WindowsTokenAdapter.Observe();
   bool queryRejected=QueryTarget!=0&&QueryMode!="read-stale-error",threadRejected=ThreadTarget!=0&&ThreadMode!="absent";bool rejected=queryRejected||threadRejected;
   if(queryRejected && Probes!=QueryTarget)throw new Exception("query timeline");
   if(threadRejected && Threads!=ThreadTarget)throw new Exception("thread timeline");
   if(rejected && !ForceCloseFailure && r.code!="E_QUERY")throw new Exception("query code");
   if(!rejected && fault=="none" && Arrays.Count!=4)throw new Exception("array tracking");
   if(fault=="query-after-sid" && Arrays.Count!=2)throw new Exception("partial tracking");
   if(fault=="close-current" && Arrays.Count!=4)throw new Exception("helper tracking");
   if(!rejected && !ForceCloseFailure && fault=="none" && r.status!="PASS")throw new Exception("baseline");
   if(r.status!=(rejected||ForceCloseFailure?"UNKNOWN":fault=="none"||fault=="admin-absent"||fault=="nonadmin-logon"?"PASS":fault=="admin-enabled"?"FAIL":"UNKNOWN"))throw new Exception("fault accepted");
   if((fault=="close"||fault=="close-current"||fault=="close-throw"||fault=="close-current-throw"||fault=="thread-close")&&r.code!="E_CLOSE")throw new Exception("cleanup priority");
   if(fault=="changed"&&r.code!="E_CHANGED")throw new Exception("changed code");
   if((fault=="impersonation"||fault=="impersonation-late")&&r.code!="E_IMPERSONATION")throw new Exception("impersonation code");
   if((fault=="sid"||fault=="group-table"||fault=="group-truncated"||fault=="group-duplicate"||fault=="group-attrs"||fault=="admin-reserved"||fault=="admin-logon"||fault=="admin-null")&&r.code!="E_FORMAT")throw new Exception("format code");
   if(QueryTarget==0&&ThreadTarget==0&&!ForceCloseFailure){string[] e=Expected[fault].Split(':');if(r.code!=e[0]||r.diagnosticStage!=e[1]||r.diagnosticCategory!=e[2])throw new Exception("exact original diagnostic");}
   if(r.schema!="math.g0.token-api.v2")throw new Exception("schema");
   if(QueryTarget!=0 && !ForceCloseFailure){string category=QueryMode.StartsWith("probe-")?(QueryMode=="probe-zero"||QueryMode=="probe-huge"?"BOUNDS":"PROBE"):QueryMode=="read-error"||QueryMode=="read-error-other"?"READ":QueryMode=="read-stale-error"?"NONE":"BOUNDS";if(r.diagnosticStage!=(queryRejected?"Q"+QueryTarget:"NONE")||r.diagnosticCategory!=category)throw new Exception("query diagnostic");}
   if(ThreadTarget!=0){string category=ThreadMode=="success-zero"||ThreadMode=="success-invalid"?"BOUNDS":ThreadMode=="absent"?"NONE":"PROBE";if(r.diagnosticStage!=(threadRejected?"T"+ThreadTarget:"NONE")||r.diagnosticCategory!=category)throw new Exception("thread diagnostic");}
   if(ForceCloseFailure && (r.code!="E_CLOSE"||r.diagnosticStage!="CLEANUP"))throw new Exception("combined cleanup priority");
   if(r.code=="E_CLOSE"&&r.diagnosticCategory!="CLOSE")throw new Exception("close diagnostic");
   if(r.apiStatus=="OK"&&(r.diagnosticStage!="NONE"||r.diagnosticCategory!="NONE"))throw new Exception("success diagnostic");
   if(r.localExecute||r.isolationConfirmed||r.admission!="BLOCKED")throw new Exception("gate");
   foreach(var b in Arrays)foreach(byte x in b)if(x!=0)throw new Exception("managed cleanup skipped");
   if(Live.Count!=0||Memory.Count!=0)throw new Exception("resource not attempted");
   Results.Add(r);
  }
 }
}
