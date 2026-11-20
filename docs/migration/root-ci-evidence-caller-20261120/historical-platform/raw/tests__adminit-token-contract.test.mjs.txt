import test from 'node:test';import assert from 'node:assert/strict';
const sample=()=>({schema:'math.g0.token-api.v1',scope:'CURRENT_PROCESS_OBSERVATION',apiStatus:'OK',status:'PASS',code:'NONE',tokenType:'PRIMARY',integrityRid:8192,elevated:false,adminEnabled:false,authority:'NONE',isolationConfirmed:false,localExecute:false,admission:'BLOCKED'});
test('structured token observation requires Medium and non-elevated/non-admin, never admission',async()=>{const{validateTokenObservation}=await import('../scripts/adminit-containment/token-contract.mjs');const r=validateTokenObservation(sample());assert.equal(r.status,'PASS');assert.equal(r.localExecute,false);assert.equal(r.isolationConfirmed,false);assert.equal(r.admission,'BLOCKED');for(const change of [{integrityRid:12288},{integrityRid:4096},{elevated:true},{adminEnabled:true}])assert.throws(()=>validateTokenObservation({...sample(),...change}),/BLOCKED/);for(const change of [{integrityRid:12288},{integrityRid:4096},{elevated:true},{adminEnabled:true}])assert.equal(validateTokenObservation({...sample(),...change,status:'FAIL'}).status,'FAIL');});
test('structured contract rejects private data, malformed/contradictory API results and false unlocks',async()=>{const{validateTokenObservation}=await import('../scripts/adminit-containment/token-contract.mjs');for(const change of [{sid:'private'},{handle:'1'},{pid:1},{stack:'private'},{integrityRid:'8192'},{elevated:0},{adminEnabled:null},{apiStatus:'ERROR'},{status:'UNKNOWN'},{tokenType:'IMPERSONATION'},{localExecute:true},{admission:'READY'},{code:'raw-error'}])assert.throws(()=>validateTokenObservation({...sample(),...change}),/BLOCKED/);const unavailable={...sample(),apiStatus:'ERROR',status:'UNKNOWN',code:'E_QUERY',tokenType:'UNKNOWN',integrityRid:null,elevated:null,adminEnabled:null};assert.equal(validateTokenObservation(unavailable).status,'UNKNOWN');assert.throws(()=>validateTokenObservation({...unavailable,integrityRid:8192}),/BLOCKED/);});
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const v2=(change={})=>({...sample(),schema:'math.g0.token-api.v2',diagnosticStage:'NONE',diagnosticCategory:'NONE',...change});
const errorV2=(change={})=>v2({apiStatus:'ERROR',status:'UNKNOWN',code:'E_QUERY',tokenType:'UNKNOWN',integrityRid:null,elevated:null,adminEnabled:null,diagnosticStage:'Q2',diagnosticCategory:'PROBE',...change});
test('v2 diagnostics are bounded metadata and never change error or admission',async()=>{const{validateTokenObservation:v}=await import('../scripts/adminit-containment/token-contract.mjs');assert.equal(v(v2()).status,'PASS');for(const stage of ['Q1','Q2','Q3','Q4','Q5','Q6','Q7'])for(const category of ['PROBE','READ','BOUNDS']){const r=v(errorV2({diagnosticStage:stage,diagnosticCategory:category}));assert.equal(r.code,'E_QUERY');assert.equal(r.status,'UNKNOWN');assert.equal(r.admission,'BLOCKED');}assert.equal(v(errorV2({code:'E_CLOSE',diagnosticStage:'CLEANUP',diagnosticCategory:'CLOSE'})).code,'E_CLOSE');assert.equal(v(errorV2({code:'E_FORMAT',diagnosticCategory:'BOUNDS'})).code,'E_FORMAT');});
test('v2 rejects private, malformed, impossible and mixed-version diagnostic fields',async()=>{const{validateTokenObservation:v}=await import('../scripts/adminit-containment/token-contract.mjs');for(const patch of [{diagnosticStage:'Q8'},{diagnosticStage:2},{diagnosticStage:'private-marker'},{diagnosticCategory:'5'},{diagnosticCategory:{raw:5}},{diagnosticCategory:null},{diagnosticCategory:'CLOSE'},{code:'E_INTERNAL',diagnosticCategory:'OPEN'},{code:'E_CLOSE'},{diagnosticStage:'NONE',diagnosticCategory:'NONE'},{status:'PASS'},{localExecute:true},{authority:'OPERATOR'},{rawError:5},{sid:'private-marker'},{pid:1},{path:'private-marker'}])assert.throws(()=>v(errorV2(patch)),/BLOCKED/);for(const field of ['diagnosticStage','diagnosticCategory']){const r=errorV2();delete r[field];assert.throws(()=>v(r),/BLOCKED/);}assert.throws(()=>v({...sample(),diagnosticStage:'NONE',diagnosticCategory:'NONE'}),/BLOCKED/);assert.throws(()=>v(v2({diagnosticStage:'Q1',diagnosticCategory:'PROBE'})),/BLOCKED/);});
test('v2 CLI keeps exit2 and never echoes rejected diagnostic data',()=>{const path=fileURLToPath(new URL('../scripts/adminit-containment/token-contract.mjs',import.meta.url));for(const r of [v2(),errorV2(),errorV2({code:'E_CLOSE',diagnosticStage:'CLEANUP',diagnosticCategory:'CLOSE'})]){const out=spawnSync(process.execPath,[path],{input:JSON.stringify(r),encoding:'utf8',timeout:5000,windowsHide:true});assert.equal(out.status,2);assert.deepEqual(JSON.parse(out.stdout),r);assert.equal(out.stderr,'');}for(const change of [{diagnosticStage:'private-marker'},{diagnosticCategory:'private-marker'},{rawError:'private-marker'}]){const out=spawnSync(process.execPath,[path],{input:JSON.stringify(errorV2(change)),encoding:'utf8',timeout:5000,windowsHide:true});assert.equal(out.status,2);assert.equal(out.stdout,'');assert.equal(out.stderr.trim(),'G0_TOKEN_OBSERVATION_BLOCKED');}});

test('v2 rejects impossible OS/OS internal-error attribution',async()=>{
 const {validateTokenObservation:v}=await import('../scripts/adminit-containment/token-contract.mjs');
 const r={...sample(),schema:'math.g0.token-api.v2',
  apiStatus:'ERROR',status:'UNKNOWN',code:'E_INTERNAL',tokenType:'UNKNOWN',
  integrityRid:null,elevated:null,adminEnabled:null,
  diagnosticStage:'OS',diagnosticCategory:'OS'};
 assert.throws(()=>v(r),/BLOCKED/);
 const actualOs={...r,code:'E_OS'};
 assert.equal(v(actualOs).code,'E_OS');
 const unknown={...r,diagnosticStage:'UNKNOWN',diagnosticCategory:'UNKNOWN'};
 assert.equal(v(unknown).status,'UNKNOWN');
});

test('v1/v2 diagnostic schema boundaries reject mixed fields and private identifiers',async()=>{
 const {validateTokenObservation:v}=await import('../scripts/adminit-containment/token-contract.mjs');
 const base={...sample()};
 const v2={...base,schema:'math.g0.token-api.v2',diagnosticStage:'NONE',diagnosticCategory:'NONE'};
 assert.equal(v(base).schema,'math.g0.token-api.v1');
 assert.equal(v(v2).schema,'math.g0.token-api.v2');
 assert.throws(()=>v({...base,diagnosticStage:'NONE'}),/BLOCKED/);
 assert.throws(()=>v({...v2,diagnosticCategory:undefined}),/BLOCKED/);
 for(const field of ['sid','pid','handle','rawWin32Error','tokenBuffer','path']){
  assert.throws(()=>v({...v2,[field]:'private-marker'}),/BLOCKED/);
 }
});
test('v2 E_CLOSE is restricted to close-capable stages, never PASS',async()=>{
 const {validateTokenObservation:v}=await import('../scripts/adminit-containment/token-contract.mjs');
 const error={...sample(),schema:'math.g0.token-api.v2',apiStatus:'ERROR',
  status:'UNKNOWN',code:'E_CLOSE',tokenType:'UNKNOWN',integrityRid:null,
  elevated:null,adminEnabled:null,diagnosticStage:'CLEANUP',diagnosticCategory:'CLOSE'};
 for(const stage of ['T1','T2','T3','Q7','CLEANUP']){
  assert.equal(v({...error,diagnosticStage:stage}).status,'UNKNOWN');
 }
 for(const stage of ['OS','LOAD','OPEN','Q1','Q2','Q3','Q4','Q5','Q6','POLICY']){
  assert.throws(()=>v({...error,diagnosticStage:stage}),/BLOCKED/);
 }
 assert.throws(()=>v({...error,status:'PASS'}),/BLOCKED/);
});
test('exhaustive independent v2 diagnostic truth table, historical v1, and OK boundaries',async()=>{
 const {validateTokenObservation:v}=await import('../scripts/adminit-containment/token-contract.mjs');
 const codes=['E_OS','E_OPEN','E_QUERY','E_FORMAT','E_CHANGED','E_IMPERSONATION','E_CLOSE','E_LOAD','E_INTERNAL'];
 const stages=['NONE','UNKNOWN','OS','LOAD','OPEN','Q1','Q2','Q3','Q4','Q5','Q6','Q7','T1','T2','T3','POLICY','CLEANUP'];
 const categories=['NONE','UNKNOWN','OS','LOAD','OPEN','PROBE','READ','BOUNDS','CLOSE','CLEANUP','IDENTITY','IMPERSONATION','INTERNAL'];
 const allowed=new Set();const add=(code,stage,category)=>allowed.add([code,stage,category].join('/'));
 for(const code of codes)add(code,'UNKNOWN','UNKNOWN'); // Explicitly unattributed pure factory.
 for(const stage of ['Q1','Q2','Q3','Q4','Q5','Q6','Q7']){
  for(const category of ['PROBE','READ','BOUNDS'])add('E_QUERY',stage,category);
  add('E_FORMAT',stage,'BOUNDS');
  for(const category of ['PROBE','READ','BOUNDS','CLEANUP'])add('E_INTERNAL',stage,category);
 }
 for(const stage of ['T1','T2','T3']){
  for(const category of ['PROBE','BOUNDS'])add('E_QUERY',stage,category);
  add('E_CLOSE',stage,'CLOSE');add('E_IMPERSONATION',stage,'IMPERSONATION');add('E_INTERNAL',stage,'PROBE');
 }
 for(const stage of ['Q7','CLEANUP'])add('E_CLOSE',stage,'CLOSE');
 for(const stage of ['OPEN','Q7'])add('E_OPEN',stage,'OPEN');
 add('E_FORMAT','POLICY','BOUNDS');add('E_CHANGED','POLICY','IDENTITY');
 add('E_OS','OS','OS');add('E_LOAD','LOAD','LOAD');
 add('E_INTERNAL','OPEN','OPEN');add('E_INTERNAL','CLEANUP','CLEANUP');
 for(const category of ['BOUNDS','IDENTITY'])add('E_INTERNAL','POLICY',category);
 assert.equal(allowed.size,92);let accepted=0,rejected=0;
 for(const code of [...codes,'NONE','E_UNRECOGNIZED'])for(const diagnosticStage of stages)for(const diagnosticCategory of categories){
  const r=errorV2({code,diagnosticStage,diagnosticCategory}),key=[code,diagnosticStage,diagnosticCategory].join('/');
  if(allowed.has(key)){const out=v(r);assert.equal(out.code,code);assert.equal(out.status,'UNKNOWN');assert.equal(out.authority,'NONE');assert.equal(out.localExecute,false);accepted++;}
  else {assert.throws(()=>v(r),/BLOCKED/,key);rejected++;}
 }
 assert.deepEqual({accepted,rejected},{accepted:92,rejected:2339});
 for(const code of codes){const legacy=errorV2({code});legacy.schema='math.g0.token-api.v1';delete legacy.diagnosticStage;delete legacy.diagnosticCategory;assert.equal(v(legacy).code,code);assert.throws(()=>v({...legacy,diagnosticStage:'UNKNOWN'}),/BLOCKED/);}
 let okAccepted=0,okRejected=0;
 for(const status of ['PASS','FAIL'])for(const diagnosticStage of stages)for(const diagnosticCategory of categories){
  const r=v2({status,integrityRid:status==='PASS'?8192:12288,diagnosticStage,diagnosticCategory});
  if(diagnosticStage==='NONE'&&diagnosticCategory==='NONE'){assert.equal(v(r).status,status);okAccepted++;}
  else {assert.throws(()=>v(r),/BLOCKED/);okRejected++;}
 }
 assert.deepEqual({okAccepted,okRejected},{okAccepted:2,okRejected:440});
});
