import pg from 'pg';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createExperimentLedger} from '../src/experiment/postgres-ledger.mjs';
import {semanticDigest} from '../src/math-universe-codec.mjs';
const ownerURL=process.env.MATH_EXPERIMENT_OWNER_URL,hostURL=process.env.MATH_EXPERIMENT_HOST_URL;
const r=n=>n.toString(16).padStart(64,'0');
// Explicit disposable database only; reset only this test's fixed schema after identity checks.
test('PG18 atomic semantic dedup, immutable bindings, fenced one-shot start and receipt recovery',{skip:!ownerURL||!hostURL?'Explicit isolated experiment owner and host URLs required':false},async()=>{
 const owner=new pg.Client({connectionString:ownerURL});await owner.connect();
 try{
  const g=(await owner.query('SELECT current_database() db,current_user role')).rows[0];
  assert.deepEqual(g,{db:'math_experiment_test',role:'math_experiment_owner'});
  await owner.query('DROP SCHEMA IF EXISTS math_experiment_lab CASCADE');
  await owner.query(await readFile(new URL('../sql/007_experiment_preregistration.sql',import.meta.url),'utf8'));
  await owner.query('GRANT USAGE ON SCHEMA math_experiment_lab TO math_experiment_host; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA math_experiment_lab TO math_experiment_host');
  await owner.query('INSERT INTO math_experiment_lab.budgets(policy_ref,proposal_limit,attempt_limit) VALUES($1,20,2)',[r(1)]);
  const intents=[0,1].map(ordinal=>({schema:'math.discovery.intent.v1',developmentRef:r(1),policyRef:r(1),catalogRef:r(1),methodRef:r(1),portStateRef:r(1),ordinal,status:'UNREGISTERED'}));
  const inputs=intents.map(i=>({schema:'math.experiment.preregistration.v1',ordinal:0,intentRef:semanticDigest(i.schema,i),foldRef:r(1),manifestRef:r(1),cohortRef:r(1),inputRef:r(1),seedRef:r(1),budgetPolicyRef:r(1),snapshotRef:r(1),fitRef:r(1),availabilityRef:r(1)}));
  const trusted={authenticateWorker:async ({workerRef})=>workerRef,resolvePreregistration:async p=>({verified:true,intent:intents.find(i=>semanticDigest(i.schema,i)===p.prereg.intentRef)}),resolveTerminal:async()=>true,openDedicatedConnection:async()=>{const c=new pg.Client({connectionString:hostURL});await c.connect();return c;}};
  const ledger=createExperimentLedger(null,trusted);
  const reservations=await Promise.all(inputs.map((p,n)=>ledger.reserve(r(10+n),p)));
  assert.deepEqual(reservations.map(x=>x.outcome).sort(),['DUPLICATE','REGISTERED']);
  assert.equal(reservations[0].attempt_ref,reservations[1].attempt_ref);
  assert.equal((await ledger.reserve(r(10),inputs[0])).attempt_ref,reservations[0].attempt_ref);
  const a=reservations[0].attempt_ref;
  const canonical=inputs.find(p=>semanticDigest('math.experiment.attempt.identity.v1',{intentRef:p.intentRef,foldRef:p.foldRef,ordinal:p.ordinal})===a);
  await assert.rejects(ledger.reserve(r(10),{...inputs[0],availabilityRef:r(4)}),/COMMAND_CONFLICT/);
  await assert.rejects(ledger.reserve(r(12),{...canonical,availabilityRef:r(4)}),/CONFLICT/);
  assert.deepEqual((await owner.query('SELECT proposals::int,attempts::int FROM math_experiment_lab.budgets')).rows,[{proposals:2,attempts:1}]);
  await assert.rejects(owner.query('UPDATE math_experiment_lab.budgets SET attempt_limit=100'),/IMMUTABLE/);
  await assert.rejects(owner.query('UPDATE math_experiment_lab.attempts SET prereg=$1',[Buffer.from('changed')]),/IMMUTABLE/);
  const claim=await ledger.claim(r(20),a,r(2));assert.equal(claim.fresh,true);
  assert.equal(Object.hasOwn((await ledger.lookup(r(20))).receipt,'token'),false);
  assert.equal(Object.hasOwn((await ledger.lookup(r(10))).receipt,'token'),false);
  assert.equal((await ledger.claim(r(20),a,r(2))).fresh,false);
  assert.equal((await ledger.start(r(21),a,r(3),claim.token)).fresh,false);
  const starts=await Promise.all([22,23].map(n=>ledger.start(r(n),a,r(2),claim.token)));
  assert.equal(starts.filter(x=>x.fresh).length,1);
  assert.equal((await ledger.start(r(22),a,r(2),claim.token)).fresh,false);
  const terminal={schema:'math.experiment.attempt.v1',intentRef:canonical.intentRef,foldRef:canonical.foldRef,ordinal:0,status:'FAILED',metricRef:null};
  await assert.rejects(ledger.finalize(r(29),terminal,r(3),claim.token),/CLAIM_MISMATCH/);
  assert.equal((await ledger.finalize(r(30),terminal,r(2),claim.token)).outcome,'COMMITTED');
  assert.equal((await ledger.finalize(r(30),terminal,r(2),claim.token)).outcome,'REPLAY');
  await assert.rejects(ledger.finalize(r(31),{...terminal,status:'CANCELLED'},r(2),claim.token),/TERMINAL_CONFLICT/);
  const receipt=await ledger.lookup(r(30));assert.equal(receipt.fresh,false);assert.equal(receipt.receipt.attempt_ref,a);assert.equal(receipt.receipt.outcome,'COMMITTED');
  // Simulate transport loss after the server has durably committed start. Recovery is lookup only.
  const lost=createExperimentLedger(null,{...trusted,openDedicatedConnection:async()=>{const c=await trusted.openDedicatedConnection();const query=c.query.bind(c);c.query=async(...args)=>{const result=await query(...args);if(args[0]==='COMMIT')throw Error('transport lost');return result;};return c;}});
  const second=await ledger.reserve(r(40),{...inputs[0],ordinal:1,seedRef:r(5)});
  const secondClaim=await ledger.claim(r(41),second.attempt_ref,r(2));
  await assert.rejects(lost.start(r(42),second.attempt_ref,r(2),secondClaim.token),/COMMIT_UNKNOWN/);
  const recovered=await ledger.lookup(r(42));assert.equal(recovered.receipt.outcome,'STARTED');assert.equal(recovered.fresh,false);
  assert.equal((await ledger.start(r(42),second.attempt_ref,r(2),secondClaim.token)).fresh,false);
  assert.equal((await ledger.start(r(43),second.attempt_ref,r(2),secondClaim.token)).fresh,false);
  await assert.rejects(ledger.reserve(r(44),{...inputs[0],ordinal:2,seedRef:r(6)}),/ATTEMPT_BUDGET/);
  // All new state-machine commands share the existing admission/proposal credit.
  for(let n=50;n<70;n++){
   try{await ledger.start(r(n),second.attempt_ref,r(3),secondClaim.token);}catch(e){assert.match(e.message,/COMMAND_BUDGET/);break;}
  }
  await assert.rejects(ledger.start(r(70),second.attempt_ref,r(3),secondClaim.token),/COMMAND_BUDGET/);
  assert.equal((await ledger.start(r(43),second.attempt_ref,r(2),secondClaim.token)).fresh,false);
  const secondTerminal={schema:'math.experiment.attempt.v1',intentRef:inputs[0].intentRef,foldRef:inputs[0].foldRef,ordinal:1,status:'FAILED',metricRef:null};
  assert.equal((await ledger.finalize(r(71),secondTerminal,r(2),secondClaim.token)).outcome,'COMMITTED');
  assert.equal((await ledger.status(second.attempt_ref)).status.state,'TERMINAL');
  assert.equal((await ledger.lookup(r(42))).receipt.outcome,'STARTED');
  assert.equal(Object.hasOwn((await ledger.lookup(r(42))).receipt,'state'),false);
  assert.deepEqual((await owner.query('SELECT proposals::int,attempts::int FROM math_experiment_lab.budgets')).rows,[{proposals:20,attempts:2}]);
  const host=await trusted.openDedicatedConnection();try{await assert.rejects(host.query('SELECT * FROM math_experiment_lab.attempts'),/permission denied/);}finally{await host.end();}
 }finally{await owner.end();}
});
