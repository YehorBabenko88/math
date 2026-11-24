import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bootstrapChildClass,bootstrapAccessChecks,bootstrapUiDiagnostics,bootstrapKernelDiagnostics} from '../scripts/adminit-containment/report-bootstrap-phase.mjs';

test('hosted child exit classification distinguishes DLL initialization from managed gates without leaking streams',()=>{
 assert.equal(bootstrapChildClass('private exception\nHOSTED_CHILD_FAILURE class=DLL_INITIALIZATION_FAILED\r\n'),'DLL_INITIALIZATION_FAILED');
 assert.equal(bootstrapChildClass('HOSTED_CHILD_FAILURE class=PRIVATE_TOKEN\n'),'UNKNOWN');
 assert.equal(bootstrapChildClass('private-prefix HOSTED_CHILD_FAILURE class=MANAGED_GATE_BLOCKED\n'),'UNKNOWN');
 assert.equal(bootstrapChildClass('x'.repeat(16385)),'UNKNOWN');
 const access='HOSTED_ACCESS_PROBE name=PACKAGE_EXE_READ_EXECUTE available=true allowed=false class=NONE';
 assert.deepEqual(bootstrapAccessChecks('private paths\n'+access+'\r\n'),[{name:'PACKAGE_EXE_READ_EXECUTE',available:true,allowed:false,failureClass:'NONE'}]);
 for(const invalid of [access.replace('PACKAGE_EXE_READ_EXECUTE','PRIVATE_TOKEN'),access.replace('class=NONE','class=PRIVATE_TOKEN'),access+'\n'+access,access.replace('available=true','available=false'),'x'.repeat(16385)])assert.deepEqual(bootstrapAccessChecks(invalid),[]);
 const ui='HOSTED_UI_CONTEXT station=NONINTERACTIVE\nHOSTED_UI_ACCESS_PROBE name=WINSTA_ACCESS_GLOBAL_ATOMS available=true allowed=false class=NONE\nHOSTED_UI_LABEL name=WINDOW_STATION available=true label=HIGH no_write_up=true no_read_up=false no_execute_up=false class=NONE';
 const emptyUi={station:'UNKNOWN',rights:[],labels:[]};
 assert.deepEqual(bootstrapUiDiagnostics('private paths\n'+ui),{station:'NONINTERACTIVE',rights:[{name:'WINSTA_ACCESS_GLOBAL_ATOMS',available:true,allowed:false,failureClass:'NONE'}],labels:[{name:'WINDOW_STATION',available:true,label:'HIGH',noWriteUp:true,noReadUp:false,noExecuteUp:false,failureClass:'NONE'}]});
 for(const invalid of [ui.replace('WINSTA_ACCESS_GLOBAL_ATOMS','PRIVATE_TOKEN'),ui.replace('label=HIGH','label=PRIVATE_SID'),ui.replace('available=true','available=false'),ui+'\n'+ui,'x'.repeat(16385)])assert.deepEqual(bootstrapUiDiagnostics(invalid),emptyUi);
 const kernel='HOSTED_POLICY_PROBE name=CHILD_WIN32K_DISABLED available=true enabled=false class=NONE\nHOSTED_KERNEL_ACCESS_PROBE name=CHILD_PROCESS_QUERY available=false allowed=false class=UNMAPPED_GENERIC_ACE\nHOSTED_KERNEL_LABEL name=CHILD_PROCESS available=true label=MEDIUM no_write_up=true no_read_up=false no_execute_up=false class=NONE';
 const emptyKernel={policies:[],rights:[],labels:[]};
 assert.deepEqual(bootstrapKernelDiagnostics(kernel),{policies:[{name:'CHILD_WIN32K_DISABLED',available:true,enabled:false,failureClass:'NONE'}],rights:[{name:'CHILD_PROCESS_QUERY',available:false,allowed:false,failureClass:'UNMAPPED_GENERIC_ACE'}],labels:[{name:'CHILD_PROCESS',available:true,label:'MEDIUM',noWriteUp:true,noReadUp:false,noExecuteUp:false,failureClass:'NONE'}]});
 for(const invalid of [kernel.replace('CHILD_WIN32K_DISABLED','PRIVATE_TOKEN'),kernel.replace('available=false allowed=false','available=true allowed=false'),kernel.replace('label=MEDIUM','label=PRIVATE_SID'),kernel+'\n'+kernel,'x'.repeat(16385)])assert.deepEqual(bootstrapKernelDiagnostics(invalid),emptyKernel);
 const source=readFileSync(new URL('./fixtures/adminit-containment/HostedMediumLauncher.cs',import.meta.url),'utf8');
 const method=/  public static string ChildExitClass\(uint code\)\{[\s\S]*?\n  \}/.exec(source)?.[0];
 assert.ok(method);
 if(process.platform==='win32'){
  // Compile/invoke only the pure classifier, never the native launcher or fixture.
  const script="$ErrorActionPreference='Stop';Add-Type -TypeDefinition $env:CHILD_STATUS_MODEL;[ChildStatusModel]::ChildExitClass(3221225794);[ChildStatusModel]::ChildExitClass(2);[ChildStatusModel]::ChildExitClass(1);[ChildStatusModel]::ChildExitClass(123456)";
  const child=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,CHILD_STATUS_MODEL:'public static class ChildStatusModel {\n'+method+'\n}'},encoding:'utf8',timeout:15000,maxBuffer:4096,windowsHide:true});
  assert.equal(child.status,0,'pure classifier compilation failed; raw output withheld');assert.equal(child.stderr,'');
  assert.deepEqual(child.stdout.trim().split(/\r?\n/),['DLL_INITIALIZATION_FAILED','MANAGED_GATE_BLOCKED','SCENARIO_FAILURE','OTHER_NONZERO']);
 }
 const directory=mkdtempSync(join(tmpdir(),'math-child-status-'));
 try{
  const path=join(directory,'private-stdout.txt');writeFileSync(path,'private paths and tokens\nHOSTED_BOOTSTRAP_PHASE=CHILD_RESULT\nHOSTED_CHILD_FAILURE class=DLL_INITIALIZATION_FAILED\n'+access+'\n'+ui+'\n'+kernel+'\n');
  const child=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/adminit-containment/report-bootstrap-phase.mjs',import.meta.url)),path],{encoding:'utf8',timeout:10000,maxBuffer:4096,windowsHide:true});
  assert.equal(child.status,0);assert.equal(child.stderr,'');
  assert.equal(child.stdout.trim(),'HOSTED_BOOTSTRAP_FAILURE phase=CHILD_RESULT\nHOSTED_CHILD_FAILURE class=DLL_INITIALIZATION_FAILED\n'+access+'\n'+ui+'\n'+kernel);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
