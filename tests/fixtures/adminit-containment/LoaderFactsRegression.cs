namespace MathUniverse.LoaderRegression {
using System;using System.Runtime.InteropServices;using MathUniverse.AdminitHosted;
public static class OwnLoaderFactsRegression {
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr h);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint rights,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool CreateRestrictedToken(IntPtr token,uint flags,uint disable,IntPtr sids,uint delete,IntPtr privileges,uint restrict,IntPtr restrictions,out IntPtr result);
 static void Need(bool value){if(!value)throw new InvalidOperationException("LOADER_FACT_REGRESSION_FAILED");}
 public static string Run(){IntPtr token=IntPtr.Zero,limited=IntPtr.Zero;string stage="OPEN";try{
  Need(OpenProcessToken(GetCurrentProcess(),11,out token));stage="PARENT";var before=HostedLoaderFacts.InspectToken(token);if(!before.available)throw new InvalidOperationException("INSPECT_"+before.failureClass);Need(before.kind=="PRIMARY");
  Need(CreateRestrictedToken(token,5,0,IntPtr.Zero,0,IntPtr.Zero,0,IntPtr.Zero,out limited));stage="RESTRICTED";var copy=HostedLoaderFacts.InspectToken(limited);Need(copy.available&&copy.kind=="PRIMARY"&&copy.restricted&&!copy.adminEnabled&&copy.user.Equals(before.user)&&copy.session==before.session);
  stage="UNCHANGED";var after=HostedLoaderFacts.InspectToken(token);Need(after.available&&after.integrity==before.integrity&&after.user.Equals(before.user)&&after.session==before.session&&after.adminEnabled==before.adminEnabled);
  stage="BOUNDS";Need(!HostedLoaderFacts.InspectToken(IntPtr.Zero).available);Need(HostedLoaderFacts.ValidPin(new string('a',64))&&!HostedLoaderFacts.ValidPin(new string('a',64)+"\n")&&!HostedLoaderFacts.ValidPin(new string('A',64)));
  stage="PATHS";string[] paths=HostedLoaderFacts.RuntimePaths();Need(paths.Length==4);foreach(string path in paths)Need(System.IO.Path.IsPathRooted(path)&&System.IO.File.Exists(path));
  return "OWN_TOKEN_FACTS_READ_ONLY_PASSED";
 }catch{throw new InvalidOperationException("LOADER_FACT_"+stage);}finally{bool closed=true;foreach(IntPtr h in new[]{token,limited})if(h!=IntPtr.Zero)closed=CloseHandle(h)&&closed;Need(closed);}}
}

}
