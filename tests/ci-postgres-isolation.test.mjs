import test from 'node:test';
import assert from 'node:assert/strict';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
test('parallel PostgreSQL fixtures isolate identical tables and clean schemas after callback failure',{skip:!url},async()=>{
 const {default:pg}=await import('pg');const schemas=[];
 const runs=await Promise.allSettled([0,1,2].map(n=>withIsolatedPostgres(url,async({pool,schema})=>{
  schemas.push(schema);await pool.query('CREATE TABLE isolation_probe(value integer)');
  await pool.query('INSERT INTO isolation_probe VALUES($1)',[n]);
  assert.deepEqual((await pool.query('SELECT value FROM isolation_probe')).rows,[{value:n}]);
  if(n===1)throw Error('synthetic callback failure');return n;
 })));
 assert.deepEqual(runs.map(r=>r.status),['fulfilled','rejected','fulfilled']);assert.equal(new Set(schemas).size,3);
 assert.match(runs[1].reason.message,/synthetic callback failure/);
 const pool=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:5000});
 try{assert.deepEqual((await pool.query('SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname=ANY($1::text[])',[schemas])).rows,[]);}finally{await pool.end();}
});
