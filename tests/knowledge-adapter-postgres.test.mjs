import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledgeAdapterRegistry} from '../src/knowledge-adapter-registry.mjs';
import {createPostgresAdapterSnapshotStore} from '../src/knowledge-adapter-postgres.mjs';
import {proposeKnowledgeAdapter} from '../src/knowledge-adapter-planner.mjs';
test('Postgres adapter uses parameterized queries and restores snapshot',async()=>{
 const r=createKnowledgeAdapterRegistry();
 r.propose(proposeKnowledgeAdapter({from:{id:'a',referenceId:'r1',locator:'p1'},to:{id:'b',referenceId:'r2',locator:'p2'},relation:'equivalent-concept'}));
 let payload;
 const calls=[];
 const pool={async query(sql,args){calls.push({sql,args});if(sql.startsWith('INSERT')){payload=JSON.parse(args[1]);return {rows:[{snapshot_id:1,sha256:args[2]}]}}return {rows:[{payload}]}}};
 const store=createPostgresAdapterSnapshotStore(pool);
 const saved=await store.save(r);
 assert.equal(saved.sha256.length,64);
 assert.equal(calls[0].args.length,3);
 assert.deepEqual((await store.latest()).list(),r.list());
});
test('empty PostgreSQL store restores null',async()=>{
 const store=createPostgresAdapterSnapshotStore({async query(){return {rows:[]}}});
 assert.equal(await store.latest(),null);
});
