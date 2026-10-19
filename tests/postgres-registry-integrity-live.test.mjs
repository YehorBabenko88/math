import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {applyMathMigrations} from '../src/postgres-migrations.mjs';
import {createKnowledgeAdapterRegistry} from '../src/knowledge-adapter-registry.mjs';
import {createPostgresAdapterSnapshotStore} from '../src/knowledge-adapter-postgres.mjs';
import {proposeKnowledgeAdapter} from '../src/knowledge-adapter-planner.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
const live=(name,fn)=>test(name,{skip:!url},()=>withIsolatedPostgres(url,fn));
function registry(approved=false,unicode=true){
 const r=createKnowledgeAdapterRegistry();
 const proposal=structuredClone(proposeKnowledgeAdapter({from:{id:'a',referenceId:'r1',locator:'p1'},to:{id:'b',referenceId:'r2',locator:'p2'},relation:'equivalent-concept'}));
 if(unicode)proposal.notes={'long-key':'α\u0000\ud800','短':'😀'};
 if(approved){proposal.blockers=[];proposal.evidence=[{source:'synthetic'}];}
 const record=r.propose(proposal);
 if(approved){r.validate(record.id,{passed:true,checks:['synthetic check']});r.review(record.id,{approved:true,reviewer:'reviewer',reason:'synthetic only'});}
 return r;
}
live('registry proposed and approved IDs survive real JSONB, Unicode and exact JSON roundtrip',async({pool})=>{
 await applyMathMigrations(pool);const store=createPostgresAdapterSnapshotStore(pool);
 for(const approved of [false,true]){const r=registry(approved);await store.save(r);assert.equal((await store.latest()).exportJSON(),r.exportJSON());}
});
live('registry validates stored checksum before restoring a valid but substituted snapshot',async({pool})=>{
 await applyMathMigrations(pool);const store=createPostgresAdapterSnapshotStore(pool);await store.save(registry());
 await pool.query("UPDATE mu_adapter_snapshots SET sha256=repeat('0',64)");
 await assert.rejects(store.latest(),/checksum/i);
});
live('legacy JSONB is accepted only when exact bytes and ID fingerprints remain verifiable',async({pool})=>{
 await applyMathMigrations(pool);const store=createPostgresAdapterSnapshotStore(pool);const r=registry(false,false);const json=r.exportJSON();
 await pool.query('INSERT INTO mu_adapter_snapshots(schema_version,payload,sha256) VALUES($1,$2::jsonb,$3)',['math-universe-adapter-registry/v1',json,createHash('sha256').update(json).digest('hex')]);
 await assert.rejects(store.latest(),/legacy|checksum/i);
 // An explicit save of the original, fingerprint-validated exact registry is
 // sufficient evidence to re-encode this same checksum without changing IDs.
 await store.save(r);assert.equal((await store.latest()).exportJSON(),json);
 assert.equal((await pool.query('SELECT count(*) AS n FROM mu_adapter_snapshots')).rows[0].n,'1');
 await pool.query('DELETE FROM mu_adapter_snapshots');
 const empty=createKnowledgeAdapterRegistry();const original=JSON.parse(empty.exportJSON());
 const reordered=JSON.stringify({schema:original.schema,records:original.records});
 // JSONB normally orders "schema" before "records". Hash the observed bytes,
 // never pretend these are historical bytes from a populated old registry.
 const projected=(await pool.query('SELECT $1::jsonb AS payload',[reordered])).rows[0].payload;
 const verified=JSON.stringify(projected);
 await pool.query('INSERT INTO mu_adapter_snapshots(schema_version,payload,sha256) VALUES($1,$2::jsonb,$3)',['math-universe-adapter-registry/v1',verified,createHash('sha256').update(verified).digest('hex')]);
 assert.deepEqual((await store.latest()).list(),[]);
});

