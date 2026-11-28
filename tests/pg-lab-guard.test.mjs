import test from 'node:test';
import assert from 'node:assert/strict';
import {labConfig,labEnvironment,checkedClient} from '../scripts/pg-lab-guard.mjs';
const env={MATH_PG_LAB_APPROVAL:'MASTER_APPROVED_DISPOSABLE_PG18_25432',MATH_PG_LAB_SYSTEM_ID:'1234567890123456789'};
const url='postgresql://math_experiment_owner:fixture-only@127.0.0.1:25432/math_experiment_test';
const role='math_experiment_owner';
test('canonical fixture configuration is explicit and frozen',()=>assert.deepEqual(labConfig(url,role,env),{host:'127.0.0.1',port:25432,database:'math_experiment_test',user:role,password:'fixture-only',ssl:false,connectionTimeoutMillis:3000}));
for(const [name,invalid] of Object.entries({scheme:url.replace('postgresql:','postgres:'),query:url+'?host=example.invalid',queryDb:url+'?dbname=postgres',queryUser:url+'?user=lab',queryPort:url+'?port=5432',emptyQuery:url+'?',fragment:url+'#fragment',emptyFragment:url+'#',port:url.replace('25432','5432'),host:url.replace('127.0.0.1','localhost'),encodedHost:url.replace('127.0.0.1','%31%32%37.0.0.1'),encodedPassword:url.replace('fixture-only','fixture%2donly'),db:url.replace('/math_experiment_test','/postgres'),user:url.replace(role,'lab'),newline:url+'\n'}))test('reject '+name,()=>assert.throws(()=>labConfig(invalid,role,env),/PG_LAB_REFUSED/));
for(const key of ['PGHOST','PGPORT','PGUSER','PGDATABASE','PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGPASSFILE','pgsslmode','NODE_PG_FORCE_NATIVE'])test('reject inherited '+key,()=>assert.throws(()=>labEnvironment({...env,[key]:'override'}),/PG_LAB_REFUSED/));
test('approval and nonzero bounded cluster identity required',()=>{for(const e of [{},{...env,MATH_PG_LAB_APPROVAL:'yes'},{...env,MATH_PG_LAB_SYSTEM_ID:'0'},{...env,MATH_PG_LAB_SYSTEM_ID:'18446744073709551616'}])assert.throws(()=>labEnvironment(e),/PG_LAB_REFUSED/);});
test('actual pg driver construction without connect',async t=>{
 let pg;try{pg=(await import('pg')).default;}catch(e){if(e.code==='ERR_MODULE_NOT_FOUND')return t.skip('pg unavailable');throw e;}
 const saved={...process.env};try{for(const k of Object.keys(process.env))if(/^PG/i.test(k)||/^NODE_PG_FORCE_NATIVE$/i.test(k))delete process.env[k];Object.assign(process.env,env);const c=checkedClient(pg.Client,url,role);assert.equal(c.connectionParameters.host,'127.0.0.1');assert.equal(c.connectionParameters.port,25432);assert.throws(()=>checkedClient(pg.Client,url+'?host=example.invalid',role),/PG_LAB_REFUSED/);}finally{for(const k of Object.keys(process.env))if(!Object.hasOwn(saved,k))delete process.env[k];Object.assign(process.env,saved);}
});
