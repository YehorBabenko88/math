import test from 'node:test';
import assert from 'node:assert/strict';
import {applyMathMigrations} from '../src/postgres-migrations.mjs';
test('migration runner serializes and applies scripts once',async()=>{
 const calls=[];let released=false;
 const client={async query(sql,args){calls.push({sql,args});if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[{filename:'001_adapter_snapshots.sql'}]};return {rows:[]}},release(){released=true}};
 const executed=await applyMathMigrations({async connect(){return client}},{readSql:async()=> 'BEGIN;\nCREATE TABLE example(id int);\nCOMMIT;'});
 assert.deepEqual(executed,['002_ingestion_jobs.sql']);
 assert.equal(calls.filter(x=>x.sql.includes('CREATE TABLE example')).length,1);
 assert.equal(calls.at(-1).sql,'COMMIT');
 assert.equal(released,true);
});
test('migration failure rolls back and releases client',async()=>{
 const calls=[];let released=false;
 const client={async query(sql){calls.push(sql);if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[]};if(sql.includes('CREATE TABLE broken'))throw Error('invalid sql');return {rows:[]}},release(){released=true}};
 await assert.rejects(applyMathMigrations({async connect(){return client}},{readSql:async()=> 'BEGIN; CREATE TABLE broken; COMMIT;'}),/invalid sql/);
 assert.ok(calls.includes('ROLLBACK'));assert.equal(released,true);
});
