import {setTimeout as delay} from 'node:timers/promises';
// Owned synthetic fixture only: a still-valid capability shortens its future
// deadline, then database wall time confirms expiry. Never disable SQL guards.
export async function expireFencedFixture(pool,lease){
 const c=await pool.connect();try{
  await c.query('BEGIN');await c.query("SELECT set_config('math_universe.claim_token',$1,true)",[lease.claim_token]);
  await c.query("UPDATE mu_ingestion_jobs SET lease_until=clock_timestamp()+interval '100 milliseconds' WHERE job_id=$1",[lease.job_id]);await c.query('COMMIT');
 }catch(error){await c.query('ROLLBACK');throw error}finally{c.release();}
 for(let n=0;n<200;n++){
  if((await pool.query('SELECT lease_until<=clock_timestamp() AS expired FROM mu_ingestion_jobs WHERE job_id=$1',[lease.job_id])).rows[0].expired)return;
  await delay(10);
 }
 throw Error('Synthetic fixture lease did not expire');
}
