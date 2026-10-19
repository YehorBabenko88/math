import test from 'node:test';
import {createHash} from 'node:crypto';
import {migrationClient} from './helpers/generic-migration-client.mjs';
import assert from 'node:assert/strict';
import {applyMathMigrations} from '../src/postgres-migrations.mjs';
test('migration runner serializes and applies scripts once',async()=>{
 const calls=[];let released=false;
 const client={async query(sql,args){calls.push({sql,args});if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[{filename:'001_adapter_snapshots.sql'}]};return {rows:[]}},release(){released=true}};
 migrationClient(client,{entries:[{filename:'001_adapter_snapshots.sql',sha256:createHash('sha256').update('BEGIN;\nCREATE TABLE example(id int);\nCOMMIT;').digest('hex'),hash_contract:'sha256-raw-utf8/v1',applied_at:'2026-01-01T00:00:00Z'}]});
 const executed=await applyMathMigrations({async connect(){return migrationClient(client)}},{readSql:async()=> 'BEGIN;\nCREATE TABLE example(id int);\nCOMMIT;'});
 assert.deepEqual(executed,['002_ingestion_jobs.sql','003_ingestion_claim_fencing.sql','004_ingestion_checkpoints.sql','005_ingestion_service_protocol.sql']);
 assert.equal(calls.filter(x=>x.sql.includes('CREATE TABLE example')).length,4);
 assert.equal(calls.at(-1).sql,'COMMIT');
 assert.equal(released,true);
});

test('checkpoint migration is additive and runner skips all five applied files',async()=>{
 const done=[];const bodies=[];
 const client={async query(sql,args){if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:done.map(filename=>({filename}))};if(sql.startsWith('INSERT INTO mu_schema_migrations'))done.push(args[0]);else bodies.push(sql);return {rows:[]}},release(){}};
 const pool={async connect(){return migrationClient(client)}};
 assert.deepEqual(await applyMathMigrations(pool),['001_adapter_snapshots.sql','002_ingestion_jobs.sql','003_ingestion_claim_fencing.sql','004_ingestion_checkpoints.sql','005_ingestion_service_protocol.sql']);
 assert.ok(bodies.some(sql=>/ADD COLUMN IF NOT EXISTS checkpoint jsonb/.test(sql)));
 assert.deepEqual(await applyMathMigrations(pool),[]);
 assert.equal(bodies.filter(sql=>/ADD COLUMN IF NOT EXISTS checkpoint jsonb/.test(sql)).length,1);
});

test('checkpoint migration failure rolls back after the first three scripts',async()=>{
 const calls=[];let released=false;
 const client={async query(sql){calls.push(sql);if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[]};if(/ADD COLUMN IF NOT EXISTS checkpoint jsonb/.test(sql))throw Error('checkpoint migration rejected');return {rows:[]}},release(){released=true}};
 await assert.rejects(applyMathMigrations({async connect(){return migrationClient(client)}}),/checkpoint migration rejected/);
 assert.equal(calls.at(-1),'ROLLBACK');assert.equal(calls.includes('COMMIT'),false);assert.equal(released,true);
});

test('commented SQL transaction wrappers cannot release the outer transaction or strip function bodies',async()=>{
 const bodies=[];const client={async query(sql){if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[]};if(sql.includes('CREATE FUNCTION'))bodies.push(sql);return {rows:[]}},release(){}};
 const scripts=[
  '-- migration header\nBEGIN;\nCREATE FUNCTION sample() RETURNS void AS $$ BEGIN RETURN; END $$ LANGUAGE plpgsql;\nCOMMIT;\n-- footer\n',
  ' /* migration header */\n-- line header\nBEGIN; CREATE FUNCTION sample() RETURNS void AS $$ BEGIN RETURN; END $$ LANGUAGE plpgsql; COMMIT; /* footer */',
 ];
 for(const script of scripts)await applyMathMigrations({async connect(){return migrationClient({...client})}},{readSql:async()=>script});
 assert.equal(bodies.length,10);
 for(const sql of bodies){assert.match(sql,/\$\$ BEGIN RETURN; END \$\$/);assert.doesNotMatch(sql,/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*BEGIN\s*;/i);assert.doesNotMatch(sql,/COMMIT\s*;/i)}
});
test('migration failure rolls back and releases client',async()=>{
 const calls=[];let released=false;
 const client={async query(sql){calls.push(sql);if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[]};if(sql.includes('CREATE TABLE broken'))throw Error('invalid sql');return {rows:[]}},release(){released=true}};
 await assert.rejects(applyMathMigrations({async connect(){return migrationClient(client)}},{readSql:async()=> 'BEGIN; CREATE TABLE broken; COMMIT;'}),/invalid sql/);
 assert.ok(calls.includes('ROLLBACK'));assert.equal(released,true);
});

test('wrapper removal preserves nested comments, BOM and quoted transaction text',async()=>{
 const script='\uFEFF/* outer /* nested */ header */ BEGIN;\nCREATE FUNCTION sample() RETURNS text AS $fn$ BEGIN RETURN \'COMMIT;\'; END $fn$ LANGUAGE plpgsql;\nCOMMIT; -- misleading COMMIT;\n/* footer COMMIT; */';
 const bodies=[];
 const client={async query(sql){if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[]};if(sql.includes('CREATE FUNCTION'))bodies.push(sql);return {rows:[]}},release(){}};
 await applyMathMigrations({async connect(){return migrationClient(client)}},{readSql:async()=>script});
 assert.equal(bodies.length,5);
 for(const body of bodies){assert.equal(body.startsWith('\uFEFF'),false);assert.ok(body.includes('/* outer /* nested */ header */'));assert.ok(body.includes("$fn$ BEGIN RETURN 'COMMIT;'; END $fn$"));assert.ok(body.includes('/* footer COMMIT; */'));assert.doesNotMatch(body,/header \*\/ BEGIN;/);assert.doesNotMatch(body,/\nCOMMIT;/)}
});

test('extra transaction commands are rejected before script execution',async()=>{
 for(const command of ['COMMIT','ROLLBACK','END','ABORT','START TRANSACTION','PREPARE TRANSACTION \'escape\'']){
  const calls=[];
  const client={async query(sql){calls.push(sql);return {rows:[]}},release(){}};
  await assert.rejects(applyMathMigrations({async connect(){return migrationClient(client)}},{readSql:async()=>`BEGIN; CREATE TABLE example(id int); ${command}; SELECT 1; COMMIT;`}),/transaction control/i);
  assert.equal(calls.some(sql=>sql.includes('CREATE TABLE example')),false);assert.deepEqual(calls,[]);
 }
});

test('comment-only COMMIT is preserved and never treated as a wrapper',async()=>{
 const script="SELECT 'COMMIT;', E'escaped\\\' COMMIT;', \"COMMIT;\"; -- COMMIT;\n/* nested /* COMMIT; */ COMMIT; */";
 const bodies=[];const client={async query(sql){if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[]};if(sql.startsWith('SELECT \'COMMIT;'))bodies.push(sql);return {rows:[]}},release(){}};
 await applyMathMigrations({async connect(){return migrationClient(client)}},{readSql:async()=>script});
 assert.deepEqual(bodies,[script,script,script,script,script]);
});

test('unmatched wrappers and malformed lexical constructs fail closed',async()=>{
 for(const script of ['BEGIN; SELECT 1;', 'SELECT 1; COMMIT;', 'BEGIN; COMMIT; COMMIT;', "SELECT 'unfinished", '/* unfinished', 'SELECT $fn$unfinished']){
  const calls=[];const client={async query(sql){calls.push(sql);return {rows:[]}},release(){}};
  await assert.rejects(applyMathMigrations({async connect(){return migrationClient(client)}},{readSql:async()=>script}),/transaction control|Unterminated migration/);
  assert.deepEqual(calls,[]);assert.equal(calls.includes(script),false);
 }
});

test('rollback failure preserves original error and discards the client',async()=>{
 const original=Error('migration failed');const rollback=Error('connection lost');const released=[];
 const client={async query(sql){if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[]};if(sql==='ROLLBACK')throw rollback;if(sql.includes('CREATE TABLE broken'))throw original;return {rows:[]}},release(error){released.push(error)}};
 await assert.rejects(applyMathMigrations({async connect(){return migrationClient(client)}},{readSql:async()=> 'BEGIN; CREATE TABLE broken; COMMIT;'}),error=>error===original);
 assert.deepEqual(released,[rollback]);
});

test('successful rollback preserves original error and releases normally',async()=>{
 const original=Error('migration failed');const released=[];
 const client={async query(sql){if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[]};if(sql.includes('CREATE TABLE broken'))throw original;return {rows:[]}},release(error){released.push(error)}};
 await assert.rejects(applyMathMigrations({async connect(){return migrationClient(client)}},{readSql:async()=> 'BEGIN; CREATE TABLE broken; COMMIT;'}),error=>error===original);
 assert.deepEqual(released,[undefined]);
});


test('leading BOM is removed while quoted BOM content is preserved',async()=>{
 const script="\uFEFFSELECT '\uFEFF';";const bodies=[];
 const client={async query(sql){if(sql==='SELECT filename FROM mu_schema_migrations')return {rows:[]};if(sql.includes("SELECT '\uFEFF'"))bodies.push(sql);return {rows:[]}},release(){}};
 await applyMathMigrations({async connect(){return migrationClient(client)}},{readSql:async()=>script});
 assert.deepEqual(bodies,Array(5).fill("SELECT '\uFEFF';"));
});
