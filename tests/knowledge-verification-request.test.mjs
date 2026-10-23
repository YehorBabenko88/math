import test from 'node:test';
import assert from 'node:assert/strict';
import {CandidateGraph} from '../src/knowledge/candidate-store.mjs';
import {buildVerificationRequest} from '../src/knowledge/verification-request.mjs';
const h='sha256:'+'a'.repeat(64);
const source='sha256:'+'b'.repeat(64);
const make=(kind,id,ctx)=>({entity_id:id,kind,statement:{format:'text',content:id,context_hash:ctx},provenance:{source_id:'book',source_hash:source,page:1,extraction_method:'manual'}});
test('request binds theorem, proof and context without verifying them',()=>{
 const graph=new CandidateGraph();
 const t=graph.addCandidate(make('THEOREM','t',h));
 const p=graph.addCandidate(make('PROOF','p',h));
 const req=buildVerificationRequest(graph,t.revision_id,p.revision_id,h);
 assert.equal(req.requested_status,'PENDING');
 assert.equal(graph.getRevision(t.revision_id).status,'CANDIDATE');
 assert.ok(Object.isFrozen(req));
});
test('context mismatch and swapped types fail closed',()=>{
 const graph=new CandidateGraph();
 const t=graph.addCandidate(make('THEOREM','t',h));
 const p=graph.addCandidate(make('PROOF','p','sha256:'+'c'.repeat(64)));
 assert.throws(()=>buildVerificationRequest(graph,t.revision_id,p.revision_id,h),/context mismatch/);
 assert.throws(()=>buildVerificationRequest(graph,p.revision_id,t.revision_id,h),/invalid verification targets/);
});
