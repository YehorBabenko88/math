// Separate hosted-only NON_QUALIFYING experiment. Never a substitute for the target suite.
// CreateRestrictedToken flags5 = DISABLE_MAX_PRIVILEGE|LUA_TOKEN. No SANDBOX_INERT.
// https://learn.microsoft.com/windows/win32/api/securitybaseapi/nf-securitybaseapi-createrestrictedtoken
// https://learn.microsoft.com/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessasuserw
namespace MathUniverse.AdminitHosted {
 using System;using System.IO;using System.Text;using System.Collections.Generic;
 using System.Runtime.InteropServices;using System.Security.Cryptography;using MathUniverse.Q01;
 public static class ClrEntryDiagnostics {
  [StructLayout(LayoutKind.Sequential)] struct SidAttributes {public IntPtr Sid;public uint Attributes;}
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup {public uint Size;public string Reserved,Desktop,Title;public uint X,Y,XSize,YSize,XCount,YCount,Fill,Flags;public ushort Show,ReservedSize;public IntPtr ReservedBytes,Input,Output,Error;}
  [StructLayout(LayoutKind.Sequential)] struct Info {public IntPtr Process,Thread;public uint ProcessId,ThreadId;}
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateDirectory(string path,IntPtr security);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint rights,out IntPtr token);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr memory,uint length,out uint needed);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool CreateRestrictedToken(IntPtr token,uint flags,uint disable,IntPtr sids,uint delete,IntPtr privileges,uint restrict,IntPtr restrictions,out IntPtr result);
  [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool ConvertStringSidToSid(string text,out IntPtr sid);
  [DllImport("advapi32.dll")] static extern uint GetLengthSid(IntPtr sid);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool SetTokenInformation(IntPtr token,int kind,IntPtr memory,uint length);
  [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessAsUser(IntPtr token,string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref Startup startup,out Info info);
  static void Need(bool value){if(!value)throw new InvalidOperationException();}
  static void NoLinks(string path){Need(Path.IsPathRooted(path)&&!path.StartsWith("\\\\")&&path.IndexOf('/',0)<0);for(string p=path;!String.IsNullOrEmpty(p);p=Path.GetDirectoryName(p))Need((File.GetAttributes(p)&FileAttributes.ReparsePoint)==0);}
  static bool MayLower(IntPtr token){IntPtr memory=IntPtr.Zero;try{uint n;GetTokenInformation(token,25,IntPtr.Zero,0,out n);Need(Marshal.GetLastWin32Error()==122&&n>=IntPtr.Size+4&&n<=65536);memory=Marshal.AllocHGlobal((int)n);uint actual;Need(GetTokenInformation(token,25,memory,n,out actual)&&actual>=IntPtr.Size+4&&actual<=n);IntPtr sid=Marshal.ReadIntPtr(memory);long at=sid.ToInt64()-memory.ToInt64();Need(at>=0&&at+12<=actual&&Marshal.ReadByte(sid)==1&&Marshal.ReadByte(sid,1)==1);uint rid=unchecked((uint)Marshal.ReadInt32(sid,8));return rid==8192||rid==12288;}finally{if(memory!=IntPtr.Zero)Marshal.FreeHGlobal(memory);}}
  static SortedDictionary<string,string> EnvironmentFor(string variant,string profile,string windows){
   var values=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
   foreach(string key in new[]{"GITHUB_ACTIONS","RUNNER_ENVIRONMENT","RUNNER_TEMP","SOURCE_HEAD","SOURCE_TREE"})values.Add(key,Environment.GetEnvironmentVariable(key));
   values.Add("SystemRoot",windows);values.Add("WINDIR",windows);values.Add("TEMP",Environment.GetEnvironmentVariable("RUNNER_TEMP"));values.Add("TMP",Environment.GetEnvironmentVariable("RUNNER_TEMP"));
   if(variant=="SYSTEM_PATH"){string system=Path.Combine(windows,"System32"),framework=Path.Combine(windows,"Microsoft.NET","Framework64","v4.0.30319");NoLinks(system);NoLinks(framework);string cmd=Path.Combine(system,"cmd.exe");NoLinks(cmd);values.Add("PATH",system+";"+windows+";"+framework);values.Add("COMSPEC",cmd);}
   if(variant=="OWNED_PROFILE"){NoLinks(profile);NoLinks(Path.Combine(profile,"AppData","Local"));NoLinks(Path.Combine(profile,"AppData","Roaming"));values.Add("USERPROFILE",profile);values.Add("LOCALAPPDATA",Path.Combine(profile,"AppData","Local"));values.Add("APPDATA",Path.Combine(profile,"AppData","Roaming"));}
   // Separate NON_QUALIFYING single-variable experiment; baseline and token policy stay fixed.
   if(variant=="SYSTEM_PROGRAMDATA"){string common=Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);Need(!String.IsNullOrEmpty(common)&&Path.IsPathRooted(common));common=Path.GetFullPath(common);NoLinks(common);Need(Directory.Exists(common));values.Add("ProgramData",common);}
   return values;
  }
  static string OsControlPath(){string system=Environment.GetFolderPath(Environment.SpecialFolder.System);Need(!String.IsNullOrEmpty(system)&&Path.IsPathRooted(system));string exe=Path.GetFullPath(Path.Combine(system,"cmd.exe"));NoLinks(exe);Need(File.Exists(exe));return exe;}
  static string OsControlCommand(){return "\""+OsControlPath()+"\" /d /c exit 71";}
  static string ParseOsPin(byte[] raw){Need(raw!=null&&raw.Length==65&&raw[64]==10);for(int i=0;i<64;i++)Need((raw[i]>=48&&raw[i]<=57)||(raw[i]>=97&&raw[i]<=102));return Encoding.ASCII.GetString(raw,0,64);}
  static string HashImage(FileStream image){image.Position=0;using(var hash=SHA256.Create())return BitConverter.ToString(hash.ComputeHash(image)).Replace("-","").ToLowerInvariant();}
  static void OsControl(IntPtr token,string build,string cwd,string profile,string windows){try{string pin=Path.Combine(build,"os-control.sha256");NoLinks(pin);string expected;using(var file=new FileStream(pin,FileMode.Open,FileAccess.Read,FileShare.Read)){Need(file.Length<=66);byte[] raw=new byte[(int)file.Length];int at=0,n;while(at<raw.Length&&(n=file.Read(raw,at,raw.Length-at))>0)at+=n;Need(at==raw.Length);expected=ParseOsPin(raw);}
   string exe=OsControlPath();using(var image=new FileStream(exe,FileMode.Open,FileAccess.Read,FileShare.Read)){long length=image.Length;Need(length>0&&length<=128*1024*1024&&HashImage(image)==expected);string outcome=Run(token,exe,cwd,EnvironmentFor("BASE",profile,windows),true);Need(image.Length==length&&HashImage(image)==expected);Console.Out.WriteLine("PROCESS_DIAGNOSTIC name=SYSTEM_CMD outcome="+outcome+" pin=BUILD_HOST_OS_PIN_MATCHED qualification=NONE");}
  }catch{Console.Out.WriteLine("PROCESS_DIAGNOSTIC name=SYSTEM_CMD outcome=UNAVAILABLE pin=UNAVAILABLE qualification=NONE");}}

  static string Run(IntPtr token,string exe,string cwd,SortedDictionary<string,string> values,bool osControl=false){
   IntPtr env=IntPtr.Zero,job=IntPtr.Zero,p=IntPtr.Zero,t=IntPtr.Zero;bool assigned=false;var kernel=new WindowsJobKernel();string outcome="UNAVAILABLE";
   try{var block=new StringBuilder();foreach(var pair in values){Need(pair.Value!=null&&pair.Value.IndexOf('\0')<0);block.Append(pair.Key).Append('=').Append(pair.Value).Append('\0');}block.Append('\0');env=Marshal.StringToHGlobalUni(block.ToString());job=kernel.CreateJob();kernel.ConfigureKillOnClose(job);var startup=new Startup();startup.Size=(uint)Marshal.SizeOf(typeof(Startup));Info info;
    if(osControl)Need(String.Equals(exe,OsControlPath(),StringComparison.OrdinalIgnoreCase));Need(CreateProcessAsUser(token,exe,new StringBuilder(osControl?OsControlCommand():"\""+exe+"\""),IntPtr.Zero,IntPtr.Zero,false,4|0x400|0x08000000,env,cwd,ref startup,out info));p=info.Process;t=info.Thread;kernel.Assign(job,p);assigned=true;kernel.Resume(t);
    if(kernel.Wait(p,10000)!=0)outcome="DEADLINE";else{uint code=kernel.ExitCode(p);outcome=code==71?(osControl?"ENTRY_REACHED":"CLR_ENTRY_REACHED"):code==0xC0000142?"DLL_INITIALIZATION_FAILED":code==0xC0000135?"DLL_NOT_FOUND":code==0xC000007B?"INVALID_IMAGE_FORMAT":"OTHER_EXIT";}
   }catch{outcome="UNAVAILABLE";}finally{try{if(assigned){kernel.TerminateJob(job);Need(kernel.WaitJobEmpty(job,5000));}else if(p!=IntPtr.Zero){kernel.TerminateProcess(p);Need(kernel.Wait(p,5000)==0);}}catch{outcome="CLEANUP_UNCONFIRMED";}finally{foreach(IntPtr h in new[]{p,t,job})if(h!=IntPtr.Zero&&!CloseHandle(h))outcome="CLEANUP_UNCONFIRMED";if(env!=IntPtr.Zero)Marshal.FreeHGlobal(env);}}
   return outcome;
  }
  public static int Main(string[] args){IntPtr token=IntPtr.Zero,limited=IntPtr.Zero,sid=IntPtr.Zero,label=IntPtr.Zero;string owned=null;bool createdOwned=false;try{
   Need(Environment.GetEnvironmentVariable("GITHUB_ACTIONS")=="true"&&Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT")=="github-hosted"&&!String.Equals(Environment.MachineName,"ADMINIT",StringComparison.OrdinalIgnoreCase));Need(args.Length==2);
   string temp=Path.GetFullPath(Environment.GetEnvironmentVariable("RUNNER_TEMP")).TrimEnd('\\')+"\\",build=Path.GetFullPath(args[0]);owned=Path.GetFullPath(args[1]);Need(build.StartsWith(temp,StringComparison.OrdinalIgnoreCase)&&owned.StartsWith(temp,StringComparison.OrdinalIgnoreCase)&&!Directory.Exists(owned)&&!File.Exists(owned));Need(String.Equals(Path.GetDirectoryName(owned),temp.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase)&&Path.GetFileName(owned)=="adminit-clr-diagnostic");NoLinks(build);NoLinks(Path.Combine(build,"package"));NoLinks(Path.GetDirectoryName(owned));
   string exe=Path.Combine(build,"ClrEntryProbe.exe"),pin=Path.Combine(build,"clr-entry.sha256");NoLinks(exe);NoLinks(pin);string expected;using(var pinStream=new FileStream(pin,FileMode.Open,FileAccess.Read,FileShare.Read)){Need(pinStream.Length==64);using(var reader=new StreamReader(pinStream)){expected=reader.ReadToEnd();}}Need(expected.Length==64&&System.Text.RegularExpressions.Regex.IsMatch(expected,"\\A[0-9a-f]{64}\\z"));
   using(var image=new FileStream(exe,FileMode.Open,FileAccess.Read,FileShare.Read)){Need(image.Length>0&&image.Length<=65536);using(var hash=SHA256.Create())Need(BitConverter.ToString(hash.ComputeHash(image)).Replace("-","").ToLowerInvariant()==expected);
    Need(OpenProcessToken(GetCurrentProcess(),11|0x80,out token)&&MayLower(token));Need(CreateRestrictedToken(token,5,0,IntPtr.Zero,0,IntPtr.Zero,0,IntPtr.Zero,out limited));Need(ConvertStringSidToSid("S-1-16-8192",out sid));label=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(SidAttributes)));Marshal.StructureToPtr(new SidAttributes{Sid=sid,Attributes=0x20},label,false);Need(SetTokenInformation(limited,25,label,(uint)Marshal.SizeOf(typeof(SidAttributes))+GetLengthSid(sid)));
    Need(CreateDirectory(owned,IntPtr.Zero));createdOwned=true;NoLinks(owned);string profile=Path.Combine(owned,"profile");Directory.CreateDirectory(Path.Combine(profile,"AppData","Local"));Directory.CreateDirectory(Path.Combine(profile,"AppData","Roaming"));NoLinks(profile);
    string windows=Environment.GetFolderPath(Environment.SpecialFolder.Windows);NoLinks(windows);foreach(string variant in new[]{"BASE","SYSTEM_PATH","OWNED_PROFILE","SYSTEM_PROGRAMDATA"}){string result;try{result=Run(limited,exe,Path.Combine(build,"package"),EnvironmentFor(variant,profile,windows));}catch{result="UNAVAILABLE";}Console.Out.WriteLine("HOSTED_CLR_DIAGNOSTIC variant="+variant+" outcome="+result+" qualification=NONE");}
    OsControl(limited,build,Path.Combine(build,"package"),profile,windows);
   }
  }catch{Console.Out.WriteLine("HOSTED_CLR_DIAGNOSTIC variant=SETUP outcome=UNAVAILABLE qualification=NONE");}finally{foreach(IntPtr h in new[]{token,limited})if(h!=IntPtr.Zero)CloseHandle(h);if(sid!=IntPtr.Zero)LocalFree(sid);if(label!=IntPtr.Zero)Marshal.FreeHGlobal(label);
   // Only known empty directories created above are removed; never recursive deletion.
   if(createdOwned)try{foreach(string rel in new[]{"profile\\AppData\\Local","profile\\AppData\\Roaming","profile\\AppData","profile",""}){string path=Path.Combine(owned,rel);if(Directory.Exists(path)){NoLinks(path);Directory.Delete(path,false);}}}catch{Console.Out.WriteLine("HOSTED_CLR_DIAGNOSTIC variant=CLEANUP outcome=CLEANUP_UNCONFIRMED qualification=NONE");}
  }return 0;}
 }
}
