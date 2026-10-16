import test from 'node:test';
import assert from 'node:assert/strict';
import {applyMathMigrations} from '../src/postgres-migrations.mjs';
test('migration runner serializes and applies scripts once',async()=>{
 const calls=[];let released=false;
 const client={async query(sql,args){calls.push({sql,args});if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[{filename:'001_adapter_snapshots.sql'}]};return {rows:[]}},release(){released=true}};
 const executed=await applyMathMigrations({async connect(){return client}},{readSql:async()=> 'BEGIN;\nCREATE TABLE example(id int);\nCOMMIT;'});
 assert.deepEqual(executed,['002_ingestion_jobs.sql','003_ingestion_claim_fencing.sql','004_ingestion_checkpoints.sql']);
 assert.equal(calls.filter(x=>x.sql.includes('CREATE TABLE example')).length,3);
 assert.equal(calls.at(-1).sql,'COMMIT');
 assert.equal(released,true);
});

test('checkpoint migration is additive and runner skips all four applied files',async()=>{
 const done=[];const bodies=[];
 const client={async query(sql,args){if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:done.map(filename=>({filename}))};if(sql.startsWith('INSERT INTO mu_schema_migrations'))done.push(args[0]);else bodies.push(sql);return {rows:[]}},release(){}};
 const pool={async connect(){return client}};
 assert.deepEqual(await applyMathMigrations(pool),['001_adapter_snapshots.sql','002_ingestion_jobs.sql','003_ingestion_claim_fencing.sql','004_ingestion_checkpoints.sql']);
 assert.ok(bodies.some(sql=>/ADD COLUMN IF NOT EXISTS checkpoint jsonb/.test(sql)));
 assert.deepEqual(await applyMathMigrations(pool),[]);
 assert.equal(bodies.filter(sql=>/ADD COLUMN IF NOT EXISTS checkpoint jsonb/.test(sql)).length,1);
});

test('checkpoint migration failure rolls back after the first three scripts',async()=>{
 const calls=[];let released=false;
 const client={async query(sql){calls.push(sql);if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[]};if(/ADD COLUMN IF NOT EXISTS checkpoint jsonb/.test(sql))throw Error('checkpoint migration rejected');return {rows:[]}},release(){released=true}};
 await assert.rejects(applyMathMigrations({async connect(){return client}}),/checkpoint migration rejected/);
 assert.equal(calls.at(-1),'ROLLBACK');assert.equal(calls.includes('COMMIT'),false);assert.equal(released,true);
});

test('commented SQL transaction wrappers cannot release the outer transaction or strip function bodies',async()=>{
 const bodies=[];const client={async query(sql){if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[]};if(sql.includes('CREATE FUNCTION'))bodies.push(sql);return {rows:[]}},release(){}};
 const scripts=[
  '-- migration header\nBEGIN;\nCREATE FUNCTION sample() RETURNS void AS $$ BEGIN RETURN; END $$ LANGUAGE plpgsql;\nCOMMIT;\n-- footer\n',
  ' /* migration header */\n-- line header\nBEGIN; CREATE FUNCTION sample() RETURNS void AS $$ BEGIN RETURN; END $$ LANGUAGE plpgsql; COMMIT; /* footer */',
 ];
 for(const script of scripts)await applyMathMigrations({async connect(){return client}},{readSql:async()=>script});
 assert.equal(bodies.length,8);
 for(const sql of bodies){assert.match(sql,/\$\$ BEGIN RETURN; END \$\$/);assert.doesNotMatch(sql,/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*BEGIN\s*;/i);assert.doesNotMatch(sql,/COMMIT\s*;/i)}
});
test('migration failure rolls back and releases client',async()=>{
 const calls=[];let released=false;
 const client={async query(sql){calls.push(sql);if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[]};if(sql.includes('CREATE TABLE broken'))throw Error('invalid sql');return {rows:[]}},release(){released=true}};
 await assert.rejects(applyMathMigrations({async connect(){return client}},{readSql:async()=> 'BEGIN; CREATE TABLE broken; COMMIT;'}),/invalid sql/);
 assert.ok(calls.includes('ROLLBACK'));assert.equal(released,true);
});
