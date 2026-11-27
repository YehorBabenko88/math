import {encodeMetadata} from '../math-universe-codec.mjs';
import {validatePreregistration} from './preregistration-contract.mjs';
import {registerAttempt} from './trial-ledger.mjs';
const ref=x=>{if(typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x))throw Error('INVALID_REF');return x;};
// Trusted host only. Deliberately no kernel execution or authority grant.
export function createExperimentLedger(pool){
 async function tx(fn){
  const c=await pool.connect();let begun=false,committing=false;
  try{
   // A dedicated pool is mandatory; no caller-supplied transaction/client.
   await c.query('BEGIN ISOLATION LEVEL READ COMMITTED');begun=true;
   const g=(await c.query("SELECT current_database() AS db, current_user AS role, current_setting('server_version_num')::int AS version")).rows[0];
   if(g.db!=='math_experiment_test'||g.role!=='math_experiment_host'||g.version<180000||g.version>=190000)throw Error('LAB_ONLY');
   await c.query('SET LOCAL synchronous_commit = on');
   const result=await fn(c);
   committing=true;await c.query('COMMIT');begun=false;
   return result;
  }catch(e){
   if(begun&&!committing)try{await c.query('ROLLBACK');}catch{}
   if(committing)throw Error('COMMIT_UNKNOWN');
   throw e;
  }finally{c.release(true);}
 }
 return Object.freeze({
  async reserve(input){
   const p=validatePreregistration(input);
   const bytes=encodeMetadata(p.prereg);
   return tx(async c=>{
    const q=await c.query('SELECT * FROM math_experiment_lab.reserve_attempt($1,$2,$3,$4,$5,$6)',[p.attemptRef,p.preregRef,p.prereg.intentRef,p.prereg.foldRef,p.prereg.ordinal,bytes]);
    return Object.freeze({...q.rows[0],executionAuthority:false});
   });
  },
  async start(attemptRef){
   ref(attemptRef);
   // A fresh committed CAS is not protected admission. No executable token is exposed.
   return tx(async c=>{
    const q=await c.query('SELECT math_experiment_lab.start_attempt($1) AS fresh',[attemptRef]);
    return Object.freeze({fresh:q.rows[0].fresh===true,executionAuthority:false});
   });
  },
  async finalize(input){
   const a=registerAttempt(input),bytes=encodeMetadata(a.attempt);
   return tx(async c=>{
    const q=await c.query('SELECT math_experiment_lab.finish_attempt($1,$2) AS outcome',[a.attemptRef,bytes]);
    return Object.freeze({outcome:q.rows[0].outcome,executionAuthority:false});
   });
  }
 });
}
