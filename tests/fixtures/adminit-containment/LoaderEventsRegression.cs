namespace MathUniverse.LoaderRegression {
 using System;using System.Diagnostics;using System.Globalization;using MathUniverse.AdminitHosted;
 public static class OwnLoaderEventsRegression {
  static void Need(bool value){if(!value)throw new InvalidOperationException("EVENT_CORRELATION_REGRESSION_FAILED");}
  public static string Run(){
   DateTime now=DateTime.UtcNow;string stamp=now.ToString("o",CultureInfo.InvariantCulture),image="C:\\fixed\\probe.exe";
   string prefix="<Event xmlns='http://schemas.microsoft.com/win/2004/08/events/event'><System><Provider Name='Microsoft-Windows-CodeIntegrity'/><EventID>3077</EventID><TimeCreated SystemTime='"+stamp+"'/><Execution ProcessID='42'/></System>",suffix="</Event>";
   Func<string,LoaderEventProbe.Match> parse=fields=>LoaderEventProbe.ClassifyXml(prefix+"<EventData>"+fields+"</EventData>"+suffix,"CI",42,image,now.AddSeconds(-1),now.AddSeconds(1));
   var publisher=parse("");Need(publisher.valid&&!publisher.pid&&!publisher.image);
   var actual=parse("<Data Name='ProcessId'>42</Data>");Need(actual.valid&&actual.pid&&!actual.image);
   var hex=parse("<Data Name='ProcessId'>0x2a</Data>");Need(hex.valid&&hex.pid);
   var imageOnly=parse("<Data Name='ProcessName'>"+image+"</Data>");Need(imageOnly.valid&&!imageOnly.pid&&imageOnly.image);
   var other=parse("<Data Name='ProcessId'>43</Data><Data Name='ProcessName'>"+image+"</Data>");Need(other.valid&&!other.pid&&!other.image);
   Need(!parse("<Data Name='ProcessId'>42</Data><Data Name='TargetProcessId'>43</Data>").valid);
   Need(!parse("<Data Name='ProcessId'>raw</Data>").valid);
   Need(!LoaderEventProbe.ClassifyXml(new string('X',32769),"CI",42,image,now,now).valid);
   Need(!LoaderEventProbe.ClassifyXml("<!DOCTYPE Event [<!ENTITY x SYSTEM 'file:///denied'>]>"+prefix+suffix,"CI",42,image,now,now).valid);
   Need(!LoaderEventProbe.ClassifyXml((prefix+suffix).Replace("Microsoft-Windows-CodeIntegrity","Unknown"),"CI",42,image,now,now).valid);
   var outside=LoaderEventProbe.ClassifyXml(prefix+suffix,"CI",42,image,now.AddSeconds(1),now.AddSeconds(2));Need(outside.valid&&!outside.pid&&!outside.image);
   using(var process=Process.GetCurrentProcess()){DateTime future=now.AddDays(1);var query=LoaderEventProbe.Query("APPLICATION",(uint)process.Id,process.MainModule.FileName,future,future.AddSeconds(1),Stopwatch.StartNew());Need(query.available&&query.records==0&&query.failure=="NONE");}
   // A missing budget fails closed without opening a log.
   var rejected=LoaderEventProbe.Query("APPLICATION",42,image,now,now,null);Need(!rejected.available&&rejected.failure=="BUDGET_EXHAUSTED");
   return "READ_ONLY_EVENT_CORRELATION_PASSED";
  }
 }
}
