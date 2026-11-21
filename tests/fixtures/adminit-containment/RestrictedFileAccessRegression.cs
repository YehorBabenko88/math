// Fresh own fixture ACLs only. Never assign/impersonate a token or launch a process.
public static class OwnRestrictedFileAccessRegression {
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool CreateRestrictedToken(IntPtr token,uint flags,uint disable,IntPtr sids,uint delete,IntPtr privileges,uint restrict,IntPtr restrictions,out IntPtr result);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool SetFileSecurity(string path,uint information,byte[] descriptor);
 static void Need(bool value){if(!value)throw new InvalidOperationException("OWN_FILE_ACCESS_REGRESSION_FAILED");}
 static void Acl(string path,bool directory,bool caller,System.Security.Principal.SecurityIdentifier user,bool setOwner=true){
  System.Security.AccessControl.FileSystemSecurity acl=directory?(System.Security.AccessControl.FileSystemSecurity)new System.Security.AccessControl.DirectorySecurity():new System.Security.AccessControl.FileSecurity();
  acl.SetAccessRuleProtection(true,false);if(setOwner)acl.SetOwner(user);
  var inherit=directory?System.Security.AccessControl.InheritanceFlags.ContainerInherit|System.Security.AccessControl.InheritanceFlags.ObjectInherit:System.Security.AccessControl.InheritanceFlags.None;
  foreach(string sid in new[]{"S-1-5-18","S-1-5-32-544"})acl.AddAccessRule(new System.Security.AccessControl.FileSystemAccessRule(new System.Security.Principal.SecurityIdentifier(sid),System.Security.AccessControl.FileSystemRights.FullControl,inherit,System.Security.AccessControl.PropagationFlags.None,System.Security.AccessControl.AccessControlType.Allow));
  if(caller)acl.AddAccessRule(new System.Security.AccessControl.FileSystemAccessRule(user,System.Security.AccessControl.FileSystemRights.FullControl,inherit,System.Security.AccessControl.PropagationFlags.None,System.Security.AccessControl.AccessControlType.Allow));
  Need(SetFileSecurity(path,0x80000004u|(setOwner?1u:0u),acl.GetSecurityDescriptorBinaryForm()));
 }
 public sealed class Result {public int checks;public bool adminOnlyDenied=true,callerAllowed=true,handlesClosed,fixtureAclRestored;}
 public static Result Run(string root){
  root=Path.GetFullPath(root);string temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\')+"\\";
  Need(root.StartsWith(temp,StringComparison.OrdinalIgnoreCase)&&Path.GetFileName(root).StartsWith("math-restricted-file-access-",StringComparison.Ordinal)&&Directory.Exists(root)&&Directory.GetFileSystemEntries(root).Length==0);
  IntPtr original=IntPtr.Zero,restricted=IntPtr.Zero;var result=new Result();
  System.Security.Principal.SecurityIdentifier user;using(var identity=System.Security.Principal.WindowsIdentity.GetCurrent()){user=identity.User;}
  string adminDir=Path.Combine(root,"admin-only"),callerDir=Path.Combine(root,"caller-only"),adminExe=Path.Combine(root,"admin-exe.bin"),callerExe=Path.Combine(root,"caller-exe.bin");
  Directory.CreateDirectory(adminDir);Directory.CreateDirectory(callerDir);File.WriteAllText(adminExe,"inert own fixture");File.WriteAllText(callerExe,"inert own fixture");
  try{
   Acl(adminDir,true,false,user);Acl(callerDir,true,true,user);Acl(adminExe,false,false,user);Acl(callerExe,false,true,user);
   Need(OpenProcessToken(GetCurrentProcess(),10,out original));Need(CreateRestrictedToken(original,5,0,IntPtr.Zero,0,IntPtr.Zero,0,IntPtr.Zero,out restricted));
   foreach(uint rights in new uint[]{0xA0000000,1,4,2}){
    var denied=RestrictedFileAccessProbe.Check(restricted,rights==0xA0000000?adminExe:adminDir,rights);
    var allowed=RestrictedFileAccessProbe.Check(restricted,rights==0xA0000000?callerExe:callerDir,rights);
    Need(denied.available&&allowed.available&&denied.failureClass=="NONE"&&allowed.failureClass=="NONE");
    result.checks+=2;result.adminOnlyDenied&=!denied.allowed;result.callerAllowed&=allowed.allowed;
   }
   Need(result.adminOnlyDenied&&result.callerAllowed);
  }finally{
   bool closed=true;foreach(IntPtr handle in new[]{restricted,original})if(handle!=IntPtr.Zero)closed=CloseHandle(handle)&&closed;
   bool restored=true;foreach(string path in new[]{adminDir,callerDir,adminExe,callerExe})try{Acl(path,Directory.Exists(path),true,user,false);}catch{restored=false;}
   Need(restored);result.fixtureAclRestored=true;Need(closed);result.handlesClosed=true;
  }
  return result;
 }
}
