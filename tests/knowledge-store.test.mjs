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

test('entity identity cannot switch mathematical kind',()=>{
 const graph=new CandidateGraph();
 graph.addCandidate(candidate('shared','A'));
 assert.throws(()=>graph.addCandidate({...candidate('shared','B'),kind:'AXIOM'}),/kind conflict/);
 assert.equal(graph.history('shared').length,1);
});

test('nonempty dependency queries return only outgoing dependency copies',()=>{
 const graph=new CandidateGraph();
 const a=graph.addCandidate(candidate('a','A')).revision_id;
 const b=graph.addCandidate(candidate('b','B')).revision_id;
 const c=graph.addCandidate(candidate('c','C')).revision_id;
 graph.addEdge({type:'DEPENDS_ON',from_revision:a,to_revision:b});
 graph.addEdge({type:'DEPENDS_ON',from_revision:a,to_revision:c});
 graph.addEdge({type:'REFERENCES',from_revision:a,to_revision:c});
 graph.addEdge({type:'DEPENDS_ON',from_revision:b,to_revision:c});
 const expected=[
  {type:'DEPENDS_ON',from_revision:a,to_revision:b,status:'CANDIDATE'},
  {type:'DEPENDS_ON',from_revision:a,to_revision:c,status:'CANDIDATE'},
 ];
 const result=graph.dependencies(a);
 assert.deepEqual(result,expected);
 result[0].status='VERIFIED';
 result.pop();
 assert.deepEqual(graph.dependencies(a),expected);
 assert.deepEqual(graph.dependencies(c),[]);
 assert.throws(()=>graph.dependencies('unknown'),/unknown revision/);
});

test('candidate store never invokes accessor after snapshot',()=>{
 const graph=new CandidateGraph();
 graph.addCandidate(candidate('stable','A'));
 let reads=0;
 const hostile={...candidate('stable','A')};
 Object.defineProperty(hostile,'entity_id',{enumerable:true,get(){reads++;throw Error('getter executed');}});
 assert.throws(()=>graph.addCandidate(hostile),/invalid data record/);
 assert.equal(reads,0);
 assert.equal(graph.history('stable').length,1);
});
test('identical content revision cannot attach to a different entity',()=>{
 const graph=new CandidateGraph();
 graph.addCandidate(candidate('first','A'));
 assert.throws(()=>graph.addCandidate(candidate('second','A')),/revision entity conflict/);
 assert.equal(graph.history('second').length,0);
});

test('same revision from a different source retains independent provenance',()=>{
 const graph=new CandidateGraph();
 const first=graph.addCandidate(candidate('theorem','A'));
 const other=candidate('theorem','A');
 other.provenance={...other.provenance,source_id:'book:2'};
 const second=graph.addCandidate(other);
 assert.notEqual(first.revision_id,second.revision_id);
 assert.equal(graph.history('theorem').length,2);
 assert.equal(graph.getRevision(first.revision_id).provenance.source_id,'book:1');
 assert.equal(graph.getRevision(second.revision_id).provenance.source_id,'book:2');
});
test('rejected duplicate revision cannot corrupt existing provenance',()=>{
 const graph=new CandidateGraph();
 const first=graph.addCandidate(candidate('first','A'));
 assert.throws(()=>graph.addCandidate(candidate('second','A')),/revision entity conflict/);
 assert.equal(graph.getRevision(first.revision_id).provenance.source_id,'book:1');
 assert.equal(graph.history('first').length,1);
});

test('mutating source records after ingestion cannot rewrite provenance or statement',()=>{
 const graph=new CandidateGraph();
 const raw=candidate('immutable','A');
 const stored=graph.addCandidate(raw);
 raw.statement.content='FORGED';
 raw.provenance.source_id='attacker';
 raw.provenance.source_hash='sha256:'+'f'.repeat(64);
 const recovered=graph.getRevision(stored.revision_id);
 assert.equal(recovered.statement.content,'A');
 assert.equal(recovered.provenance.source_id,'book:1');
 assert.equal(recovered.provenance.source_hash,source_hash);
 assert.equal(recovered.status,'CANDIDATE');
});
test('candidate status cannot be promoted through mutable history copies',()=>{
 const graph=new CandidateGraph();
 const c=graph.addCandidate(candidate('history','A'));
 const history=graph.history('history');
 history[0].status='VERIFIED';
 history[0].provenance.source_id='forged';
 assert.equal(graph.getRevision(c.revision_id).status,'CANDIDATE');
 assert.equal(graph.getRevision(c.revision_id).provenance.source_id,'book:1');
});

test('edge output mutation cannot change stored dependency',()=>{
 const graph=new CandidateGraph();
 const a=graph.addCandidate(candidate('edge-a','A')).revision_id;
 const b=graph.addCandidate(candidate('edge-b','B')).revision_id;
 const edge=graph.addEdge({type:'DEPENDS_ON',from_revision:a,to_revision:b});
 edge.status='VERIFIED';
 edge.to_revision='forged';
 assert.deepEqual(graph.dependencies(a),[{type:'DEPENDS_ON',from_revision:a,to_revision:b,status:'CANDIDATE'}]);
});
test('candidate input rejects forged VERIFIED status before graph mutation',()=>{
 const graph=new CandidateGraph();
 assert.throws(()=>graph.addCandidate({...candidate('unsafe','A'),status:'VERIFIED'}),/verification status/);
 assert.equal(graph.history('unsafe').length,0);
});

test('proxy candidate and accessor provenance are rejected without executing traps',()=>{
 const graph=new CandidateGraph();
 let reads=0;
 const proxy=new Proxy(candidate('proxy','A'),{get(){reads++;throw Error('proxy get executed');}});
 assert.throws(()=>graph.addCandidate(proxy),/invalid data record/);
 assert.equal(reads,0);
 const hostile=candidate('accessor','B');
 Object.defineProperty(hostile.provenance,'source_id',{enumerable:true,get(){reads++;throw Error('provenance getter executed');}});
 assert.throws(()=>graph.addCandidate(hostile),/invalid data record/);
 assert.equal(reads,0);
 assert.equal(graph.history('proxy').length,0);
 assert.equal(graph.history('accessor').length,0);
});
