// Own empty job/current process/thread and memory descriptors only.
public static class OwnKernelPolicyRegression {
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentThread();
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool CreateRestrictedToken(IntPtr token,uint flags,uint disable,IntPtr sids,uint delete,IntPtr privileges,uint restrict,IntPtr restrictions,out IntPtr result);
 static void Need(bool value){if(!value)throw new InvalidOperationException("OWN_KERNEL_POLICY_REGRESSION_FAILED");}
 const uint Specific=0x100000|0x1000|0x400|0x10|0x40|8;
 static byte[] Descriptor(System.Security.Principal.SecurityIdentifier user,bool caller,uint access,int count=1,bool audit=false){
  var acl=new System.Security.AccessControl.RawAcl(2,count);var sid=caller?user:new System.Security.Principal.SecurityIdentifier("S-1-5-32-544");
  for(int index=0;index<count;index++)acl.InsertAce(index,new System.Security.AccessControl.CommonAce(System.Security.AccessControl.AceFlags.None,audit?System.Security.AccessControl.AceQualifier.SystemAudit:System.Security.AccessControl.AceQualifier.AccessAllowed,unchecked((int)access),sid,false,null));
  var sd=new System.Security.AccessControl.RawSecurityDescriptor(System.Security.AccessControl.ControlFlags.SelfRelative|System.Security.AccessControl.ControlFlags.DiscretionaryAclPresent,user,user,null,acl);byte[] raw=new byte[sd.BinaryLength];sd.GetBinaryForm(raw,0);return raw;
 }
 public sealed class Result {public int checks,createdProcesses=0,assignedTokens=0,changedLimits=0;public bool genericRejected,unsupportedAceRejected,boundsRejected,jobReadOnly,mitigationBounded,borrowedHandlesPreserved,ownedHandlesClosed;}
 public static Result Run(){
  IntPtr original=IntPtr.Zero,restricted=IntPtr.Zero,job=IntPtr.Zero;var result=new Result();
  try{
   Need(OpenProcessToken(GetCurrentProcess(),10,out original));Need(CreateRestrictedToken(original,5,0,IntPtr.Zero,0,IntPtr.Zero,0,IntPtr.Zero,out restricted));
   System.Security.Principal.SecurityIdentifier user;using(var identity=System.Security.Principal.WindowsIdentity.GetCurrent()){user=identity.User;}
   byte[] admin=Descriptor(user,false,Specific),caller=Descriptor(user,true,Specific);
   for(int kind=0;kind<2;kind++)foreach(uint desired in kind==0?new uint[]{0x400,0x1000,0x10,0x100000}:new uint[]{0x40,8,0x100000}){
    var denied=RestrictedKernelPolicyProbe.CheckDescriptor(restricted,admin,kind,desired);var allowed=RestrictedKernelPolicyProbe.CheckDescriptor(restricted,caller,kind,desired);
    Need(denied.available&&allowed.available&&denied.failureClass=="NONE"&&allowed.failureClass=="NONE"&&!denied.allowed&&allowed.allowed);result.checks+=2;
   }
   var generic=RestrictedKernelPolicyProbe.CheckDescriptor(restricted,Descriptor(user,true,0x10000000),0,0x400);result.genericRejected=!generic.available&&!generic.allowed&&generic.failureClass=="UNMAPPED_GENERIC_ACE";
   var unsupported=RestrictedKernelPolicyProbe.CheckDescriptor(restricted,Descriptor(user,true,Specific,1,true),0,0x400);result.unsupportedAceRejected=!unsupported.available&&!unsupported.allowed&&unsupported.failureClass=="UNSUPPORTED_ACE";
   var large=RestrictedKernelPolicyProbe.CheckDescriptor(restricted,new byte[65537],0,0x400);var count=RestrictedKernelPolicyProbe.CheckDescriptor(restricted,Descriptor(user,true,Specific,1025),0,0x400);result.boundsRejected=!large.available&&!count.available&&large.failureClass=="SECURITY_DESCRIPTOR_BOUNDS"&&count.failureClass=="SECURITY_DESCRIPTOR_BOUNDS";
   job=CreateJobObject(IntPtr.Zero,null);Need(job!=IntPtr.Zero);var policies=RestrictedKernelPolicyProbe.QueryJob(job,false);Need(policies.Count==8);result.jobReadOnly=true;foreach(var value in policies)result.jobReadOnly&=value.available&&!value.enabled&&value.failureClass=="NONE";
   Need(RestrictedKernelPolicyProbe.QueryJob(IntPtr.Zero,true).Count==8);var mitigation=RestrictedKernelPolicyProbe.QueryMitigation(GetCurrentProcess());Need(mitigation.Count==2);result.mitigationBounded=true;foreach(var value in mitigation)result.mitigationBounded&=value.available&&value.failureClass=="NONE";
   IntPtr process=GetCurrentProcess(),thread=GetCurrentThread();string failure;byte[] processSd=RestrictedKernelPolicyProbe.ReadDescriptor(process,7,out failure);Need(processSd!=null&&failure=="NONE");byte[] threadSd=RestrictedKernelPolicyProbe.ReadDescriptor(thread,7,out failure);Need(threadSd!=null&&failure=="NONE");
   Need(RestrictedKernelPolicyProbe.InspectRights(restricted,process,0).Count==4&&RestrictedKernelPolicyProbe.InspectRights(restricted,thread,1).Count==3);
   result.borrowedHandlesPreserved=process==GetCurrentProcess()&&thread==GetCurrentThread()&&RestrictedKernelPolicyProbe.ReadDescriptor(process,7,out failure)!=null&&RestrictedKernelPolicyProbe.ReadDescriptor(thread,7,out failure)!=null;
   Need(result.genericRejected&&result.unsupportedAceRejected&&result.boundsRejected&&result.jobReadOnly&&result.mitigationBounded&&result.borrowedHandlesPreserved);
  }finally{bool closed=true;foreach(IntPtr handle in new[]{restricted,original,job})if(handle!=IntPtr.Zero)closed=CloseHandle(handle)&&closed;Need(closed);result.ownedHandlesClosed=true;}
  return result;
 }
}
