import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledgeAdapterRegistry} from '../src/knowledge-adapter-registry.mjs';
import {restoreKnowledgeAdapterRegistry} from '../src/knowledge-adapter-persistence.mjs';
import {proposeKnowledgeAdapter} from '../src/knowledge-adapter-planner.mjs';
const a={id:'a',referenceId:'book-a',locator:'p1'},b={id:'b',referenceId:'book-b',locator:'p2'},e=[{id:'e',referenceId:'book-c',locator:'p3'}];
test('registry roundtrip preserves reviewed state and provenance',()=>{
 const r=createKnowledgeAdapterRegistry();const p=r.propose(proposeKnowledgeAdapter({from:a,to:b,relation:'equivalent-concept',evidence:e}));
 r.validate(p.id,{passed:true,checks:['source comparison']});
 r.review(p.id,{approved:true,reviewer:'scientist',reason:'compared cited definitions'});
 const restored=restoreKnowledgeAdapterRegistry(r.exportJSON());
 assert.deepEqual(restored.list(),r.list());
});
test('registry restore rejects tampering and duplicate records',()=>{
 const r=createKnowledgeAdapterRegistry();r.propose(proposeKnowledgeAdapter({from:a,to:b,relation:'equivalent-concept',evidence:e}));
 const doc=JSON.parse(r.exportJSON());
 doc.records[0].id='invalid';
 assert.throws(()=>restoreKnowledgeAdapterRegistry(JSON.stringify(doc)),/fingerprint/);
 doc.records[0].id=r.list()[0].id;
 doc.records.push(structuredClone(doc.records[0]));
 assert.throws(()=>restoreKnowledgeAdapterRegistry(JSON.stringify(doc)),/Invalid registry record/);
});
test('registry restore rejects fake approval without verification',()=>{
 const r=createKnowledgeAdapterRegistry();r.propose(proposeKnowledgeAdapter({from:a,to:b,relation:'equivalent-concept',evidence:e}));
 const doc=JSON.parse(r.exportJSON());doc.records[0].state='approved';
 doc.records[0].validation={passed:false,checks:['failed']};
 doc.records[0].review={approved:true,reviewer:'attacker',reason:'bypass'};
 assert.throws(()=>restoreKnowledgeAdapterRegistry(JSON.stringify(doc)),/blockers/);
});
