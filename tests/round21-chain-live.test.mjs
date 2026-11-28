import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {labConfig,labEnvironment,connectLab} from '../scripts/pg-lab-guard.mjs';
import {runResearchBridge,inspectGridResearchSnapshot} from '../src/math-universe-research-bridge.mjs';
import {binary64Hex,semanticDigest} from '../src/math-universe-codec.mjs';
import {enumerateDiscovery} from '../src/discovery-search.mjs';
import {createExperimentLedger} from '../src/experiment/postgres-ledger.mjs';
const worker=fileURLToPath(new URL('../scripts/round21-chain-worker.py',import.meta.url));
const ownerURL=process.env.MATH_EXPERIMENT_OWNER_URL,hostURL=process.env.MATH_EXPERIMENT_HOST_URL,memoryURL=process.env.SCIENTIFIC_MEMORY_TEST_DSN;
const hash=(schema,x)=>semanticDigest(schema,x);
function python(mode,input={}){
 return new Promise((resolve,reject)=>{
  const c=spawn('python',['-I','-B',worker,mode],{windowsHide:true,env:labEnvironment(),stdio:['pipe','pipe','pipe']});
  const out=[],err=[];let bytes=0;const timeout=setTimeout(()=>{c.kill();reject(Error('CHAIN_WORKER_TIMEOUT'));},20000);
  c.stdout.on('data',b=>{bytes+=b.length;if(bytes>262144){c.kill();reject(Error('CHAIN_OUTPUT_LIMIT'));}else out.push(b);});c.stderr.on('data',b=>err.push(b));
  c.on('error',e=>{clearTimeout(timeout);reject(e);});c.on('close',code=>{clearTimeout(timeout);if(code!==0)return reject(Error(Buffer.concat(err).toString()));try{resolve(JSON.parse(Buffer.concat(out)));}catch(e){reject(e);}});
  c.stdin.on('error',()=>{});c.stdin.end(JSON.stringify(input));
 });
}
function serve(){
 const child=spawn('python',['-I','-B',worker,'serve'],{windowsHide:true,env:labEnvironment(),stdio:['ignore','pipe','pipe']});
 const ready=new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>{child.kill();reject(Error('P_HTTP_START_TIMEOUT'));},10000);child.stderr.on('data',()=>{});child.stdout.on('data',b=>{text+=b;const m=/SCIENTIFIC_MEMORY_PORT=(\d+)/.exec(text);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',()=>{clearTimeout(timer);reject(Error('P_HTTP_EXIT'));});});
 return {child,ready};
}
// Explicit component-chain lab mode avoids racing the separate L schema-reset suite.
test('synthetic pinned Grid → A/I/C/E/M → L → P HTTP → pinned Terminan S preserves denial and references',{skip:!process.env.ROUND21_CHAIN_LIVE||!ownerURL||!hostURL||!memoryURL?'Explicit component-chain lab URLs and ROUND21_CHAIN_LIVE required':false},async()=>{
 labConfig(ownerURL,'math_experiment_owner');labConfig(hostURL,'math_experiment_host');labConfig(memoryURL,'memory_lab');
 const input=await python('prepare');assert.equal(input.fixture_kind,'SYNTHETIC_LOCAL_GRID_FIXTURE');
 const snapshot=input.snapshot,refusal=inspectGridResearchSnapshot(snapshot);
 assert.equal(refusal.status,'ABSTAIN');assert.equal(refusal.reason,'GRID_AVAILABILITY_UNATTESTED');assert.equal(refusal.coverage.missing_minutes,1);
 assert.equal(refusal.coverage.gaps[0].start_ms,300000);assert.equal(refusal.requested.end_ms,360000);assert.equal(refusal.research,null);
 // A separate, explicitly synthetic fixture declaration provides known synthetic
 // availability. The B snapshot above is never upgraded into causal eligibility.
 const roster=['open','high','low','close'];
 const request={schema:'math.universe.research.request.v1',start_ms:0,end_ms:300000,as_of_ms:420000,cadence_ms:60000,roster,
  rows:snapshot.rows.flatMap(row=>roster.map(series=>({series,epoch:'SYNTHETIC_LOCAL_GRID_FIXTURE',end_ms:row.t+60000,available_ms:row.t+60001,revision:0,value_bits:binary64Hex(Number(row[series]))})))};
 const snapshotRef=refusal.snapshot_ref;let researchRef,research;
 const policy={schema:'math.r21.synthetic.command-policy.v1',proposal_limit:12,attempt_limit:1};const policyRef=hash(policy.schema,policy);
 const foldRef=hash('math.r21.synthetic.fold.v1',{start_ms:0,end_ms:300000,scope:'SYNTHETIC_DESCRIPTIVE_ONLY'});
 const manifestRef=hash('math.r21.synthetic.manifest.v1',input.pins);
 const intent=enumerateDiscovery({schema:'math.discovery.request.v1',developmentRef:snapshotRef,policyRef,catalogRef:manifestRef,methodRefs:[hash('math.r21.descriptive.method.v1',{method:'geometry_and_acf'})],portStateRefs:[hash(request.schema,request)],maxIntents:1})[0];
 const prereg={schema:'math.experiment.preregistration.v1',ordinal:0,intentRef:hash(intent.schema,intent),foldRef,manifestRef,cohortRef:hash('math.r21.synthetic.cohort.v1',{roster}),inputRef:hash(request.schema,request),seedRef:hash('math.r21.synthetic.seed.v1',{seed:0}),budgetPolicyRef:policyRef,snapshotRef,fitRef:hash('math.r21.synthetic.fit.v1',{status:'NOT_PROVIDED',scope:'DESCRIPTIVE_ONLY'}),availabilityRef:hash('math.r21.synthetic.availability.v1',{scope:input.fixture_kind,rows:request.rows.map(({series,end_ms,available_ms})=>({series,end_ms,available_ms}))})};
 const owner=await connectLab(pg.Client,ownerURL,'math_experiment_owner');
 let receipt;
 try{
  const identity=(await owner.query("SELECT current_database() AS db,current_user AS role,current_setting('server_version_num')::int AS version")).rows[0];
  assert.equal(identity.db,'math_experiment_test');assert.equal(identity.role,'math_experiment_owner');assert.ok(identity.version>=180000&&identity.version<190000);
  await owner.query('DROP SCHEMA IF EXISTS math_experiment_lab CASCADE');
  await owner.query(await readFile(new URL('../sql/007_experiment_preregistration.sql',import.meta.url),'utf8'));
  await owner.query('GRANT USAGE ON SCHEMA math_experiment_lab TO math_experiment_host;GRANT EXECUTE ON FUNCTION math_experiment_lab.reserve_attempt(text,text,text,text,text,bigint,text,bytea,text,bytea), math_experiment_lab.claim_attempt(text,text,text,uuid), math_experiment_lab.start_attempt(text,text,text,uuid), math_experiment_lab.finish_attempt(text,text,text,uuid,bytea), math_experiment_lab.lookup_command(text), math_experiment_lab.lookup_status(text) TO math_experiment_host');
  await owner.query('INSERT INTO math_experiment_lab.budgets(policy_ref,proposal_limit,attempt_limit)VALUES($1,12,1)',[policyRef]);
  // This principal is established by the isolated synthetic fixture, not by a
  // caller's workerRef. Restrict admission to the exact preregistered attempt.
  const workerRef=hash('math.r21.synthetic.worker.v1',{worker:'LOCAL_TEST'});
  const expectedAttempt=hash('math.experiment.attempt.identity.v1',{intentRef:prereg.intentRef,foldRef:prereg.foldRef,ordinal:prereg.ordinal});
  const authenticateWorker=async principal=>(
   principal.workerRef===workerRef&&principal.attemptRef===expectedAttempt&&
   ['claim','start','finalize'].includes(principal.operation)?workerRef:null
  );
  const ledger=createExperimentLedger(null,{authenticateWorker,resolvePreregistration:async p=>({verified:p.preregRef===hash(prereg.schema,prereg),intent}),resolveTerminal:async a=>a.attempt.metricRef===researchRef&&a.attempt.status==='COMPLETED',openDedicatedConnection:async()=>{return connectLab(pg.Client,hostURL,'math_experiment_host');}});
  const command=op=>hash('math.r21.synthetic.command.v1',{op,inputRef:prereg.inputRef});
  const reserved=await ledger.reserve(command('reserve'),prereg);assert.equal(reserved.outcome,'REGISTERED');assert.equal(reserved.attempt_ref,expectedAttempt);
  const outsider=hash('math.r21.synthetic.worker.v1',{worker:'OUTSIDER'});
  await assert.rejects(ledger.claim(command('unauthenticated'),expectedAttempt,outsider),/UNAUTHENTICATED_WORKER/);
  await assert.rejects(ledger.claim(command('wrong-attempt'),hash('math.r21.synthetic.unrelated.v1',{}),workerRef),/UNAUTHENTICATED_WORKER/);
  const reserveReceipt=await ledger.lookup(command('reserve'));
  assert.equal(reserveReceipt.receipt.outcome,'REGISTERED');
  const claimed=await ledger.claim(command('claim'),reserved.attempt_ref,workerRef);assert.equal(claimed.fresh,true);
  const started=await ledger.start(command('start'),reserved.attempt_ref,workerRef,claimed.token);assert.equal(started.fresh,true);assert.equal(started.executionAuthority,false);
  // Actual computation begins only after immutable preregistration and COMMIT.
  research=await runResearchBridge(request);researchRef=hash(research.schema,research);
  assert.equal(research.status,'ABSTAIN');assert.equal(research.execution_authority,false);assert.equal(research.trading_authorized,false);
  assert.equal(research.applicability.facts.dimension,4);assert.equal(research.applicability.facts.sampleCount,5);assert.equal(research.research.gaps.length,0);
  const terminal={schema:'math.experiment.attempt.v1',intentRef:prereg.intentRef,foldRef,ordinal:0,status:'COMPLETED',metricRef:researchRef};
  assert.equal((await ledger.finalize(command('finish'),terminal,workerRef,claimed.token)).outcome,'COMMITTED');
  receipt=await ledger.lookup(command('finish'));assert.equal(receipt.fresh,false);assert.equal(receipt.receipt.outcome,'COMMITTED');
  assert.equal(Object.hasOwn(receipt.receipt,'state'),false);assert.equal(Object.hasOwn(receipt.receipt,'token'),false);
  assert.equal((await ledger.status(expectedAttempt)).status.state,'TERMINAL');
  assert.deepEqual(await ledger.lookup(command('reserve')),reserveReceipt);
  assert.equal(Object.hasOwn((await ledger.lookup(command('claim'))).receipt,'token'),false);
 }finally{await owner.end();}
 const pipeline_refs={snapshot_ref:snapshotRef,research_ref:researchRef,attempt_ref:receipt.receipt.attempt_ref,prereg_ref:receipt.receipt.prereg_ref,fixture_kind:input.fixture_kind};
 const persisted=await python('persist',{snapshot,pipeline_refs});assert.equal(persisted.record.dataset.source,input.fixture_kind);assert.equal(persisted.qualification.source_authenticity,'UNATTESTED');assert.equal(persisted.qualification.execution_authority,false);assert.equal(persisted.qualification.empirical_reproduction,'UNKNOWN');
 const http=serve();try{
  const url=await http.ready;
  const consumed=await python('consume',{url,record_id:persisted.record.id});
  assert.equal(consumed.consumer_commit,'d790bd42616de4712426127b55505751625fddcb');
  assert.deepEqual(consumed.record,persisted.record);assert.deepEqual(consumed.record.pipeline_refs,pipeline_refs);
  assert.equal(consumed.record.provenance.execution_authority,false);assert.equal(consumed.record.provenance.trading_authorized,false);
 }finally{http.child.kill();}
});
