import {encodeMetadata} from '../math-universe-codec.mjs';
import {validatePreregistration} from './preregistration-contract.mjs';
import {registerAttempt} from './trial-ledger.mjs';
import {randomUUID} from 'node:crypto';
const ref=x=>{if(typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x))throw Error('INVALID_REF');return x;};
const deny=x=>Object.freeze({...x,executionAuthority:false});
// Only an isolated trusted host may instantiate this adapter. No kernel dispatch.
export function createExperimentLedger(pool, trusted){
 if(!trusted||typeof trusted.resolvePreregistration!=='function'||typeof trusted.resolveTerminal!=='function')throw Error('TRUSTED_RESOLVER_REQUIRED');
 async function tx(fn,readOnly=false){
  const c=await pool.connect();let begun=false,committing=false;
  try{
   // Discard any prior transaction before starting our own root transaction.
   await c.query('ROLLBACK');
   await c.query('BEGIN ISOLATION LEVEL READ COMMITTED'+(readOnly?' READ ONLY':''));begun=true;
   const g=(await c.query("SELECT current_database() AS db, current_user AS role, current_setting('server_version_num')::int AS version")).rows[0];
   if(g.db!=='math_experiment_test'||g.role!=='math_experiment_host'||g.version<180000||g.version>=190000)throw Error('LAB_ONLY');
   await c.query('SET LOCAL synchronous_commit = on');
   const result=await fn(c);committing=true;await c.query('COMMIT');begun=false;return result;
  }catch(e){
   if(begun&&!committing)try{await c.query('ROLLBACK');}catch{}
   if(committing)throw Error('COMMIT_UNKNOWN');throw e;
  }finally{c.release(true);}
 }
 return Object.freeze({
  async reserve(commandRef,input){
   ref(commandRef);const p=validatePreregistration(input);
   // Host resolver must verify exact references, not caller assertions.
   if(await trusted.resolvePreregistration(p)!==true)throw Error('UNVERIFIED_BINDING');
   return tx(async c=>deny((await c.query('SELECT * FROM math_experiment_lab.reserve_attempt($1,$2,$3,$4,$5,$6,$7,$8)',[commandRef,p.attemptRef,p.preregRef,p.prereg.intentRef,p.prereg.foldRef,p.prereg.ordinal,p.prereg.budgetPolicyRef,encodeMetadata(p.prereg)])).rows[0]));
  },
  async claim(commandRef,attemptRef,workerRef){
   [commandRef,attemptRef,workerRef].forEach(ref);
   const token=randomUUID();
   return tx(async c=>{
    const q=await c.query('SELECT math_experiment_lab.claim_attempt($1,$2,$3,$4) AS fresh',[commandRef,attemptRef,workerRef,token]);
    return deny({fresh:q.rows[0].fresh===true,token:q.rows[0].fresh===true?token:null});
   });
  },
  async start(commandRef,attemptRef,workerRef,token){
   [commandRef,attemptRef,workerRef].forEach(ref);
   return tx(async c=>deny({fresh:(await c.query('SELECT math_experiment_lab.start_attempt($1,$2,$3,$4) AS fresh',[commandRef,attemptRef,workerRef,token])).rows[0].fresh===true}));
  },
  async finalize(commandRef,input,workerRef,token){
   [commandRef,workerRef].forEach(ref);const a=registerAttempt(input);
   if(await trusted.resolveTerminal(a)!==true)throw Error('UNVERIFIED_TERMINAL');
   return tx(async c=>deny({outcome:(await c.query('SELECT math_experiment_lab.finish_attempt($1,$2,$3,$4,$5) AS outcome',[commandRef,a.attemptRef,workerRef,token,encodeMetadata(a.attempt)])).rows[0].outcome}));
  },
  async lookup(commandRef){
   ref(commandRef);
   return tx(async c=>deny({receipt:(await c.query('SELECT * FROM math_experiment_lab.lookup_command($1)',[commandRef])).rows[0]??null,fresh:false}),true);
  }
 });
}
