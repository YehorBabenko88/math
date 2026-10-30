$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$helper=[IO.File]::ReadAllText((Join-Path $root 'scripts/q01-lab/WindowsJobContainment.cs'))
$fixture=[IO.File]::ReadAllText((Join-Path $root 'tests/fixtures/adminit-containment/AdminitSynthetic.cs'))
$model=@'
public sealed class CleanupModel : MathUniverse.Q01.IJobKernel {
 public System.Collections.Generic.Queue<uint> Waits=new System.Collections.Generic.Queue<uint>();
 public int Kills,WaitCalls,Error;
 public uint Wait(System.IntPtr p,uint ms){uint expected=WaitCalls==0?0u:5000u;if(ms!=expected)throw new System.Exception("unexpected model wait bound");WaitCalls++;return Waits.Dequeue();}
 public void TerminateProcess(System.IntPtr p){Kills++;if(Error>0)throw new System.ComponentModel.Win32Exception(Error);if(Error<0)throw new System.InvalidOperationException("unexpected kernel failure");}
 public System.IntPtr CreateJob(){throw new System.Exception();}public void ConfigureKillOnClose(System.IntPtr j){throw new System.Exception();}
 public void CreateSuspended(string e,string[] a,string d,out System.IntPtr p,out System.IntPtr t){throw new System.Exception();}
 public void Assign(System.IntPtr j,System.IntPtr p){throw new System.Exception();}public void Resume(System.IntPtr t){throw new System.Exception();}
 public uint ExitCode(System.IntPtr p){throw new System.Exception();}public void TerminateJob(System.IntPtr j){throw new System.Exception();}
 public bool WaitJobEmpty(System.IntPtr j,uint ms){throw new System.Exception();}public void Close(System.IntPtr h){throw new System.Exception();}
}
'@
Add-Type -TypeDefinition ($helper+"`n"+$fixture+"`n"+$model) -ReferencedAssemblies System.Web.Extensions,System.Core
$method=[MathUniverse.Adminit.Synthetic].GetMethod('TerminateOwnedProcess',[Reflection.BindingFlags]'NonPublic,Static')
if($null -eq $method){throw 'Production cleanup boundary missing'}
$cases=@(
 @{name='already signalled';waits=[uint32[]]@(0);error=0;kills=0;calls=1;want=''},
 @{name='live kill';waits=[uint32[]]@(258);error=0;kills=1;calls=1;want=''},
 @{name='failed initial wait';waits=[uint32[]]@([uint32]::MaxValue);error=0;kills=0;calls=1;want='invalid'},
 @{name='exit race';waits=[uint32[]]@(258,0);error=5;kills=1;calls=2;want=''},
 @{name='live access denial';waits=[uint32[]]@(258,258);error=5;kills=1;calls=2;want='5'},
 @{name='failed race wait';waits=[uint32[]]@(258,[uint32]::MaxValue);error=5;kills=1;calls=2;want='5'},
 @{name='other native error';waits=[uint32[]]@(258);error=6;kills=1;calls=1;want='6'},
 @{name='unexpected kernel failure';waits=[uint32[]]@(258);error=-1;kills=1;calls=1;want='invalid'}
)
foreach($case in $cases){
 $kernel=New-Object CleanupModel;$kernel.Error=$case.error
 foreach($value in $case.waits){$kernel.Waits.Enqueue($value)}
 $reason=''
 try{$method.Invoke($null,@($kernel.PSObject.BaseObject,[IntPtr]1))}catch{$errorObject=$_.Exception.GetBaseException();$reason=if($errorObject -is [ComponentModel.Win32Exception]){[string]$errorObject.NativeErrorCode}elseif($errorObject -is [InvalidOperationException]){'invalid'}else{'unexpected'}}
 if($reason -ne $case.want -or $kernel.Kills -ne $case.kills -or $kernel.WaitCalls -ne $case.calls){throw ('Cleanup boundary regression: '+$case.name+' reason='+$reason+' kills='+$kernel.Kills+' waits='+$kernel.WaitCalls)}
}
Write-Output 'PASS: 8 real production cleanup-boundary model cases; no fixture processes launched'
