import test from 'node:test';
import assert from 'node:assert/strict';
import {CandidateGraph} from '../src/knowledge/candidate-store.mjs';
const source_hash='sha256:'+'a'.repeat(64);
const candidate=(entity_id,content)=>({entity_id,kind:'THEOREM',statement:{format:'text',content},provenance:{source_id:'book:1',source_hash,page:1,extraction_method:'manual'}});
test('revision history and defensive copies',()=>{
 const graph=new CandidateGraph();
 const first=graph.addCandidate(candidate('t','A'));
 const second=graph.addCandidate(candidate('t','B'));
 assert.equal(graph.history('t').length,2);
 first.status='VERIFIED';
 assert.equal(graph.getRevision(first.revision_id).status,'CANDIDATE');
 assert.notEqual(first.revision_id,second.revision_id);
});
test('idempotent insert and entity conflict',()=>{
 const graph=new CandidateGraph();
 graph.addCandidate(candidate('a','A'));
 graph.addCandidate(candidate('a','A'));
 assert.equal(graph.history('a').length,1);
 assert.throws(()=>graph.addCandidate(candidate('b','A')),/conflict/);
});
test('dangling edges fail closed and contradictions stay unresolved',()=>{
 const graph=new CandidateGraph();
 const a=graph.addCandidate(candidate('a','A'));
 const b=graph.addCandidate(candidate('b','B'));
 assert.throws(()=>graph.addEdge({type:'DEPENDS_ON',from_revision:a.revision_id,to_revision:'missing'}));
 graph.addEdge({type:'CONTRADICTS',from_revision:a.revision_id,to_revision:b.revision_id});
 assert.equal(graph.conflicts()[0].status,'UNRESOLVED');
});

test('dependency cycles fail closed without inserting edge',()=>{
 const graph=new CandidateGraph();
 const a=graph.addCandidate(candidate('a','A')).revision_id;
 const b=graph.addCandidate(candidate('b','B')).revision_id;
 const c=graph.addCandidate(candidate('c','C')).revision_id;
 graph.addEdge({type:'DEPENDS_ON',from_revision:a,to_revision:b});
 graph.addEdge({type:'DEPENDS_ON',from_revision:b,to_revision:c});
 assert.throws(()=>graph.addEdge({type:'DEPENDS_ON',from_revision:c,to_revision:a}),/cycle/);
 assert.throws(()=>graph.addEdge({type:'DEPENDS_ON',from_revision:a,to_revision:a}),/cycle/);
 assert.equal(graph.dependencies(c).length,0);
});
