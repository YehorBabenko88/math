// Read-only local EventLog correlation. Missing/unavailable events do not clear policy.
// https://learn.microsoft.com/windows/win32/api/winevt/nf-winevt-evtnext
// https://learn.microsoft.com/windows/win32/api/winevt/nf-winevt-evtrender
// https://learn.microsoft.com/windows/security/application-security/application-control/app-control-for-business/operations/event-id-explanations
// https://learn.microsoft.com/windows/security/application-security/application-control/app-control-for-business/applocker/using-event-viewer-with-applocker
namespace MathUniverse.AdminitHosted {
 using System;using System.IO;using System.Globalization;using System.Diagnostics;using System.Xml;using System.Runtime.InteropServices;
 public static class LoaderEventProbe {
  const int MaxEvents=64,MaxBytes=65536;
  [DllImport("wevtapi.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr EvtQuery(IntPtr session,string path,string query,uint flags);
  [DllImport("wevtapi.dll",SetLastError=true)] static extern bool EvtNext(IntPtr query,uint count,IntPtr[] events,uint timeout,uint flags,out uint returned);
  [DllImport("wevtapi.dll",SetLastError=true)] static extern bool EvtRender(IntPtr context,IntPtr item,uint flags,uint size,IntPtr memory,out uint used,out uint properties);
  [DllImport("wevtapi.dll",SetLastError=true)] static extern bool EvtClose(IntPtr item);
  public sealed class Match {public bool valid,pid,image;public int id;}
  public sealed class Result {public bool available;public string failure="QUERY_UNAVAILABLE";public int records;public int[] pid,image;public Result(int count){pid=new int[count];image=new int[count];}}
  static bool Number(string text,out uint value){value=0;if(String.IsNullOrEmpty(text)||text.Length>12)return false;return text.StartsWith("0x",StringComparison.OrdinalIgnoreCase)?UInt32.TryParse(text.Substring(2),NumberStyles.AllowHexSpecifier,CultureInfo.InvariantCulture,out value):UInt32.TryParse(text,NumberStyles.None,CultureInfo.InvariantCulture,out value);}
  static bool ExactImage(string value,string image){return !String.IsNullOrEmpty(value)&&value.Length<=4096&&String.Equals(value,image,StringComparison.OrdinalIgnoreCase);}
  public static Match ClassifyXml(string xml,string channel,uint pid,string image,DateTime start,DateTime end){
   var result=new Match();try{
    if(xml==null||xml.Length>MaxBytes/2||pid==0||String.IsNullOrEmpty(image)||image.Length>4096||start.Kind!=DateTimeKind.Utc||end.Kind!=DateTimeKind.Utc||end<start||end-start>TimeSpan.FromMinutes(3))return result;
    var settings=new XmlReaderSettings{DtdProcessing=DtdProcessing.Prohibit,XmlResolver=null,MaxCharactersInDocument=MaxBytes/2};var document=new XmlDocument();document.XmlResolver=null;using(var reader=XmlReader.Create(new StringReader(xml),settings))document.Load(reader);
    var ns=new XmlNamespaceManager(document.NameTable);ns.AddNamespace("e","http://schemas.microsoft.com/win/2004/08/events/event");
    XmlNode root=document.SelectSingleNode("/e:Event",ns),system=document.SelectSingleNode("/e:Event/e:System",ns);if(root==null||system==null)return result;
    uint id;if(!Number(system.SelectSingleNode("e:EventID",ns).InnerText,out id)||id>65535)return result;result.id=(int)id;
    string provider=system.SelectSingleNode("e:Provider/@Name",ns).Value;bool expected=channel=="CI"?provider=="Microsoft-Windows-CodeIntegrity":channel=="APPLOCKER"?provider=="Microsoft-Windows-AppLocker":channel=="DEFENDER"?provider=="Microsoft-Windows-Windows Defender":channel=="APPLICATION"?((id==1000&&provider=="Application Error")||(id==1001&&provider=="Windows Error Reporting")||(id==1026&&provider==".NET Runtime")):false;if(!expected)return result;
    DateTime when;if(!DateTime.TryParse(system.SelectSingleNode("e:TimeCreated/@SystemTime",ns).Value,CultureInfo.InvariantCulture,DateTimeStyles.AdjustToUniversal|DateTimeStyles.AssumeUniversal,out when))return result;
    result.valid=true;if(when<start||when>end)return result;
    // System.Execution.ProcessID identifies the publisher, not necessarily the failed child.
    // Only named subject fields below can establish a child-PID match.
    XmlNodeList fields=document.SelectNodes("/e:Event/e:EventData/e:Data|/e:Event/e:UserData//*[not(*)]",ns);if(fields.Count>128)return new Match();
    bool subjectSeen=false,subjectMatches=false,imageMatches=false;
    foreach(XmlNode field in fields){string name=field.Attributes["Name"]!=null?field.Attributes["Name"].Value:field.LocalName,value=field.InnerText;if(name.Length>64||value.Length>4096)return new Match();
     if(name=="ProcessId"||name=="ProcessID"||name=="TargetProcessId"||name=="TargetProcessID"){uint actual;if(!Number(value,out actual))return new Match();if(subjectSeen&&subjectMatches!=(actual==pid))return new Match();subjectSeen=true;subjectMatches=actual==pid;}
     if(name=="ProcessName"||name=="Process Name"||name=="ApplicationPath"||name=="AppPath"||name=="FilePath"||name=="FileName")imageMatches|=ExactImage(value,image);
    }
    result.pid=subjectSeen&&subjectMatches;result.image=!subjectSeen&&imageMatches;return result;
   }catch{return new Match();}
  }
  static string Render(IntPtr item,out string failure){failure="RENDER_UNAVAILABLE";IntPtr memory=IntPtr.Zero;try{uint used,properties;bool initial=EvtRender(IntPtr.Zero,item,1,0,IntPtr.Zero,out used,out properties);if(initial||Marshal.GetLastWin32Error()!=122)return null;if(used<2||used>MaxBytes||(used&1)!=0||properties!=0){failure="RENDER_BOUNDS";return null;}memory=Marshal.AllocHGlobal((int)used);uint actual;if(!EvtRender(IntPtr.Zero,item,1,used,memory,out actual,out properties))return null;if(actual<2||actual>used||(actual&1)!=0||properties!=0||Marshal.ReadInt16(memory,(int)actual-2)!=0){failure="RENDER_BOUNDS";return null;}return Marshal.PtrToStringUni(memory,(int)actual/2-1);}finally{if(memory!=IntPtr.Zero)Marshal.FreeHGlobal(memory);}}
  public static Result Query(string channel,uint pid,string image,DateTime start,DateTime end,Stopwatch budget){
   string path;int[] ids;Configuration(channel,out path,out ids);var result=new Result(ids.Length);IntPtr query=IntPtr.Zero;bool closed=true;
   try{
    if(budget==null||budget.ElapsedMilliseconds>=3000){result.failure="BUDGET_EXHAUSTED";return result;}
    if(pid==0||start.Kind!=DateTimeKind.Utc||end.Kind!=DateTimeKind.Utc||end<start||end-start>TimeSpan.FromMinutes(3))return result;
    string selection="*[System[TimeCreated[@SystemTime>='"+start.ToString("o",CultureInfo.InvariantCulture)+"' and @SystemTime<='"+end.ToString("o",CultureInfo.InvariantCulture)+"'] and (";for(int i=0;i<ids.Length;i++)selection+=(i==0?"":" or ")+"EventID="+ids[i];selection+=")]]";
    // Fixed local channels only. The existing independent parent watchdog remains the
    // hard whole-process bound; the 3s budget bounds enumeration, not RPC scheduling.
    query=EvtQuery(IntPtr.Zero,path,selection,0x201);if(query==IntPtr.Zero)return result;
    result.available=true;result.failure="NONE";
    while(result.records<MaxEvents){if(budget.ElapsedMilliseconds>=3000){result.failure="BUDGET_EXHAUSTED";break;}IntPtr[] item=new IntPtr[1];uint returned;
     if(!EvtNext(query,1,item,50,0,out returned)){int error=Marshal.GetLastWin32Error();if(item[0]!=IntPtr.Zero)closed=EvtClose(item[0])&&closed;if(error!=259){result.available=false;result.failure=error==1460?"BUDGET_EXHAUSTED":"ENUMERATION_UNAVAILABLE";}break;}
     if(returned!=1||item[0]==IntPtr.Zero){if(item[0]!=IntPtr.Zero)closed=EvtClose(item[0])&&closed;result.available=false;result.failure="ENUMERATION_UNAVAILABLE";break;}
     try{result.records++;string failure;string xml=Render(item[0],out failure);if(xml==null){result.available=false;result.failure=failure;break;}Match match=ClassifyXml(xml,channel,pid,image,start,end);if(!match.valid){result.available=false;result.failure="XML_REJECTED";break;}int index=Array.IndexOf(ids,match.id);if(index<0){result.available=false;result.failure="XML_REJECTED";break;}if(match.pid)result.pid[index]++;else if(match.image)result.image[index]++;}finally{closed=EvtClose(item[0])&&closed;}
    }
    if(result.records==MaxEvents&&result.failure=="NONE")result.failure="TRUNCATED";
   }catch{result.available=false;result.failure="QUERY_UNAVAILABLE";}finally{if(query!=IntPtr.Zero)closed=EvtClose(query)&&closed;if(!closed){result.available=false;result.failure="HANDLE_CLOSE_FAILED";}if(!result.available){Array.Clear(result.pid,0,result.pid.Length);Array.Clear(result.image,0,result.image.Length);}}
   return result;
  }
  static void Configuration(string channel,out string path,out int[] ids){
   switch(channel){case "CI":path="Microsoft-Windows-CodeIntegrity/Operational";ids=new[]{3033,3034,3076,3077,3089};break;case "APPLOCKER":path="Microsoft-Windows-AppLocker/EXE and DLL";ids=new[]{8002,8003,8004};break;case "DEFENDER":path="Microsoft-Windows-Windows Defender/Operational";ids=new[]{1121,1122};break;case "APPLICATION":path="Application";ids=new[]{1000,1001,1026};break;default:throw new InvalidOperationException();}
  }
  public static void Emit(uint pid,string image,DateTime start,DateTime end){try{var budget=Stopwatch.StartNew();foreach(string channel in new[]{"CI","APPLOCKER","DEFENDER","APPLICATION"}){string path;int[] ids;Configuration(channel,out path,out ids);var result=Query(channel,pid,image,start.AddSeconds(-1),end.AddSeconds(1),budget);for(int i=0;i<ids.Length;i++)Console.Out.WriteLine("HOSTED_LOADER_EVENT name="+channel+"_"+ids[i]+" available="+(result.available?"true":"false")+" pid_matches="+result.pid[i]+" image_matches="+result.image[i]+" class="+result.failure);}}catch{}}
 }
}
