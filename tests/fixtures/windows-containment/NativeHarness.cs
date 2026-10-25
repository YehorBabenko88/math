// Fixed synthetic fixtures only. Build locally; native entry is hosted-only.
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using MathUniverse.Q01;

internal static class NativeHarness {
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool member);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern uint GetProcessId(IntPtr process);
    static string Self => Environment.ProcessPath;
    static string Root;
    static void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
    static void HostedOnly() {
        Check(OperatingSystem.IsWindows() && Environment.GetEnvironmentVariable("GITHUB_ACTIONS")=="true" &&
            Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT")=="github-hosted" &&
            Environment.GetEnvironmentVariable("RUNNER_OS")=="Windows", "native fixtures require disposable GitHub-hosted Windows");
    }
    static Process Start(string mode, string directory) {
        var info=new ProcessStartInfo(Self) { UseShellExecute=false, CreateNoWindow=true, WorkingDirectory=directory };
        info.ArgumentList.Add(mode); info.ArgumentList.Add(directory);
        return Process.Start(info);
    }
    static void Until(Func<bool> condition, string message) {
        var clock=Stopwatch.StartNew();
        while (!condition()) { Check(clock.ElapsedMilliseconds<8000,message); Thread.Sleep(10); }
    }
    static void AssertDead(int pid) {
        try { using var process=Process.GetProcessById(pid); Check(process.WaitForExit(5000),"descendant survived: "+pid); }
        catch (ArgumentException) { }
    }
    static int Fixture(string mode,string dir) {
        // All fixture writes are fixed names under the owned temporary test directory.
        Check(IsProcessInJob(Process.GetCurrentProcess().Handle,IntPtr.Zero,out bool member) && member,"fixture has no job membership");
        if (mode=="--leaf") {
            File.WriteAllText(Path.Combine(dir,"leaf.pid"),Environment.ProcessId.ToString());
            Thread.Sleep(60000); return 0;
        }
        if (mode=="--tree-exit" || mode=="--tree-wait") {
            using var leaf=Start("--leaf",dir);
            Until(()=>File.Exists(Path.Combine(dir,"leaf.pid")),"leaf startup deadline");
            File.WriteAllText(Path.Combine(dir,"root.pid"),Environment.ProcessId.ToString());
            if(mode=="--tree-wait") Thread.Sleep(60000);
            return 17;
        }
        if (mode=="--environment") {
            Check(Environment.GetEnvironmentVariable("Q01_POISON")==null,"inherited parent environment");
            Check(Environment.GetEnvironmentVariable("NODE_OPTIONS")==null,"inherited NODE_OPTIONS");
            Check(Environment.GetEnvironmentVariable("TEMP")==dir && Environment.GetEnvironmentVariable("TMP")==dir,"temporary directory mismatch");
            Check(Directory.GetCurrentDirectory()==dir,"cwd mismatch");
            var args=Environment.GetCommandLineArgs();
            Check(args.Length==6 && args[3]=="quote\"inside" && args[4]=="trailing\\" && args[5]=="", "argument quoting mismatch");
            File.WriteAllText(Path.Combine(dir,"environment.ok"),"sanitized"); return 23;
        }
        throw new Exception("unknown fixed fixture");
    }
    sealed class Observed : IJobKernel {
        readonly WindowsJobKernel kernel=new();
        readonly string directory;
        public string Fault;
        public int Pid;
        public bool Assigned,Resumed,Drained;
        public Observed(string dir) { directory=dir; }
        public IntPtr CreateJob()=>kernel.CreateJob();
        public void ConfigureKillOnClose(IntPtr j)=>kernel.ConfigureKillOnClose(j);
        public void CreateSuspended(string e,string[] a,string d,out IntPtr p,out IntPtr t) {
            kernel.CreateSuspended(e,a,d,out p,out t); Pid=(int)GetProcessId(p);
            // Suspended fixture cannot write before ownership, including deliberate assignment rejection.
            Check(!File.Exists(Path.Combine(directory,"root.pid")),"fixture ran before assignment");
        }
        public void Assign(IntPtr j,IntPtr p) {
            if(Fault=="assign") throw new InvalidOperationException("injected assignment rejection");
            kernel.Assign(j,p);
            Check(IsProcessInJob(p,j,out bool member) && member,"root lacks owned job membership"); Assigned=true;
        }
        public void Resume(IntPtr t) { Check(Assigned,"resume before ownership"); kernel.Resume(t); Resumed=true; }
        public uint Wait(IntPtr p,uint ms)=>kernel.Wait(p,ms);
        public uint ExitCode(IntPtr p)=>kernel.ExitCode(p);
        public void TerminateJob(IntPtr j)=>kernel.TerminateJob(j);
        public bool WaitJobEmpty(IntPtr j,uint ms) { Drained=kernel.WaitJobEmpty(j,ms); return Drained; }
        public void TerminateProcess(IntPtr p)=>kernel.TerminateProcess(p);
        public void Close(IntPtr h)=>kernel.Close(h);
    }
    static void RunTree(bool timeout) {
        string dir=Path.Combine(Root,timeout?"timeout":"root-exit"); Directory.CreateDirectory(dir);
        var kernel=new Observed(dir); var clock=Stopwatch.StartNew(); bool timedOut=false;
        try {
            uint code=Containment.RunOwned(kernel,Self,new[]{timeout?"--tree-wait":"--tree-exit",dir},dir,timeout?4000u:15000u);
            Check(!timeout && code==17,"unexpected root result");
        } catch(TimeoutException) { timedOut=true; }
        Check(timedOut==timeout && kernel.Assigned && kernel.Resumed && kernel.Drained,"ownership/deadline/drain evidence missing");
        Check(clock.ElapsedMilliseconds<16000,"cleanup exceeded fixture bound");
        Check(File.Exists(Path.Combine(dir,"leaf.pid")),"tree did not start");
        AssertDead(int.Parse(File.ReadAllText(Path.Combine(dir,"leaf.pid")))); AssertDead(kernel.Pid);
    }
    static void AssignmentRejected() {
        string dir=Path.Combine(Root,"assignment"); Directory.CreateDirectory(dir);
        var kernel=new Observed(dir) { Fault="assign" }; bool rejected=false;
        try { Containment.RunOwned(kernel,Self,new[]{"--tree-wait",dir},dir,10000); }
        catch(InvalidOperationException e) { rejected=e.Message=="injected assignment rejection"; }
        Check(rejected && !kernel.Resumed && !File.Exists(Path.Combine(dir,"root.pid")),"assignment fail-open"); AssertDead(kernel.Pid);
    }
    static void EnvironmentAndQuoting() {
        string dir=Path.Combine(Root,"environment"); Directory.CreateDirectory(dir);
        Environment.SetEnvironmentVariable("Q01_POISON","must-not-inherit");
        Environment.SetEnvironmentVariable("NODE_OPTIONS","must-not-inherit");
        try {
            var kernel=new Observed(dir);
            uint code=Containment.RunOwned(kernel,Self,new[]{"--environment",dir,"quote\"inside","trailing\\",""},dir,15000);
            Check(code==23 && kernel.Drained && File.Exists(Path.Combine(dir,"environment.ok")),"environment/quoting fixture failed");
        } finally { Environment.SetEnvironmentVariable("Q01_POISON",null); Environment.SetEnvironmentVariable("NODE_OPTIONS",null); }
    }
    static void OwnerCrash() {
        string dir=Path.Combine(Root,"owner-crash"); Directory.CreateDirectory(dir);
        using var owner=Start("--owner",dir);
        try {
            Until(()=>File.Exists(Path.Combine(dir,"root.pid")),"owner fixture startup deadline");
            int root=int.Parse(File.ReadAllText(Path.Combine(dir,"root.pid")));
            int leaf=int.Parse(File.ReadAllText(Path.Combine(dir,"leaf.pid")));
            owner.Kill(); Check(owner.WaitForExit(5000),"owner termination unconfirmed");
            AssertDead(root); AssertDead(leaf);
        } finally { if(!owner.HasExited) { owner.Kill(); owner.WaitForExit(5000); } }
    }
    static void PublicPolicy() {
        // No policy bypass: public Run rejects the hosted runner's temp directory.
        bool blocked=false;
        try { Containment.Run(new WindowsJobKernel(),Self,Array.Empty<string>(),Root,1000); }
        catch(ArgumentException) { blocked=true; }
        Check(blocked,"public physical directory policy opened");
        foreach(string alias in new[]{Root, @"C:\Users\Administrator\AppData\Local\MathUniverseLab\..\outside", @"C:\Users\Administrator\AppData\Local\MathUniverseLab\alias.\child"}) {
            blocked=false; try { Containment.ValidateDirectory(alias); } catch(ArgumentException) { blocked=true; }
            Check(blocked,"literal policy accepted alias/outside");
        }
        // Exercise exact ancestor-reparse validator without creating the public physical lab root.
        string target=Path.Combine(Root,"target"), link=Path.Combine(Root,"link"); Directory.CreateDirectory(target);
        Directory.CreateSymbolicLink(link,target);
        var validator=typeof(Containment).GetMethod("NoReparse",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Static);
        blocked=false;
        try { validator.Invoke(null,new object[]{link}); }
        catch(System.Reflection.TargetInvocationException e) when(e.InnerException is ArgumentException) { blocked=true; }
        Check(blocked,"reparse validator accepted symbolic link");
    }
    public static int Main(string[] args) {
        HostedOnly();
        if(args.Length>=2 && args[0]=="--owner") {
            Containment.RunOwned(new WindowsJobKernel(),Self,new[]{"--tree-wait",args[1]},args[1],60000); return 0;
        }
        if(args.Length>=2 && args[0].StartsWith("--")) return Fixture(args[0],args[1]);
        Check(args.Length==1,"one owned temporary root required"); Root=Path.GetFullPath(args[0]);
        string temp=Path.GetFullPath(Environment.GetEnvironmentVariable("RUNNER_TEMP"))+Path.DirectorySeparatorChar;
        Check(Root.StartsWith(temp,StringComparison.OrdinalIgnoreCase) && !Directory.Exists(Root),"fresh hosted temporary root required");
        Directory.CreateDirectory(Root);
        var results=new List<object>();
        foreach(var test in new (string Name,Action Run)[]{("root-exit-descendant-drain",()=>RunTree(false)),("deadline-tree-drain",()=>RunTree(true)),("assignment-rejection",AssignmentRejected),("environment-quoting",EnvironmentAndQuoting),("owner-crash-kill-on-close",OwnerCrash),("public-policy-reparse",PublicPolicy)}) {
            var clock=Stopwatch.StartNew();
            try { test.Run(); results.Add(new {test.Name,status="PASS",milliseconds=clock.ElapsedMilliseconds}); }
            catch(Exception e) { results.Add(new {test.Name,status="FAIL",error=e.ToString(),milliseconds=clock.ElapsedMilliseconds}); }
        }
        File.WriteAllText(Path.Combine(Root,"results.json"),JsonSerializer.Serialize(new {sourceHead=Environment.GetEnvironmentVariable("SOURCE_HEAD"),sourceTree=Environment.GetEnvironmentVariable("SOURCE_TREE"),results},new JsonSerializerOptions{WriteIndented=true}));
        Console.WriteLine(File.ReadAllText(Path.Combine(Root,"results.json")));
        return results.Any(x=>JsonSerializer.Serialize(x).Contains("\"FAIL\""))?1:0;
    }
}
