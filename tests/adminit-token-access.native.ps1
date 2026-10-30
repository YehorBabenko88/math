$ErrorActionPreference='Stop'
# Run only token setup copied from the real launcher; never launch its fixture.
$path=Join-Path $PSScriptRoot 'fixtures/adminit-containment/HostedMediumLauncher.cs'
$source=[IO.File]::ReadAllText($path)
$start=$source.IndexOf('    Check(OpenProcessToken(')
$end=$source.IndexOf('    var values=', $start)
if($start -lt 0 -or $end -lt $start){throw 'Token setup boundary unavailable'}
$prefix=$source.Substring(0,$source.IndexOf('  public static int Main('))
$prefix=$prefix.Replace(' using MathUniverse.Q01;','')
$prefix=$prefix.Replace(' using System.Web.Script.Serialization;','')
$body=@'
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr data,uint size,out uint required);
  public static int Main(string[] args){
   IntPtr token=IntPtr.Zero,limited=IntPtr.Zero,sid=IntPtr.Zero,label=IntPtr.Zero;
   try{
'@
$suffix=@'
    VerifyMediumToken(limited);
    ObserveDesktopAccess(limited);
    foreach(int[] bad in new[]{new[]{12288,0},new[]{8192,1},new[]{4096,0}}){bool rejected=false;try{AssertMeasuredToken(bad[0],bad[1]);}catch(InvalidOperationException){rejected=true;}Check(rejected,"unsafe token accepted");}
    IntPtr data=Marshal.AllocHGlobal(256);
    try{uint size;Check(GetTokenInformation(limited,25,data,256,out size),"integrity query");
     IntPtr integritySid=Marshal.ReadIntPtr(data);byte count=Marshal.ReadByte(GetSidSubAuthorityCount(integritySid));
     Check(count>0&&Marshal.ReadInt32(GetSidSubAuthority(integritySid,(uint)(count-1)))==8192,"actual Medium integrity required");
     Check(GetTokenInformation(limited,20,data,4,out size)&&Marshal.ReadInt32(data)==0,"actual non-elevated token required");
    }finally{Marshal.FreeHGlobal(data);}
    Console.WriteLine("PASS: actual restricted-token Medium assignment; no child process created");return 0;
   }finally{
    if(label!=IntPtr.Zero)Marshal.FreeHGlobal(label);
    if(sid!=IntPtr.Zero)LocalFree(sid);
    foreach(IntPtr h in new[]{limited,token})if(h!=IntPtr.Zero)Check(CloseHandle(h),"token close failed");
   }
  }
 }
}
'@
Add-Type -TypeDefinition ($prefix+$body+$source.Substring($start,$end-$start)+$suffix)
if([MathUniverse.AdminitHosted.MediumLauncher]::Main(@()) -ne 0){throw 'Token regression failed'}
