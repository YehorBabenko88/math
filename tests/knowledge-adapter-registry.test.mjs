import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeKnowledgeAdapter} from '../src/knowledge-adapter-planner.mjs';
import {createKnowledgeAdapterRegistry} from '../src/knowledge-adapter-registry.mjs';
const from={id:'energy',referenceId:'book1',locator:'p12'},to={id:'work',referenceId:'book2',locator:'p20'};
const evidence=[{id:'check1',referenceId:'book3',locator:'p7'}];
test('adapter registry is idempotent and requires validation and human approval',()=>{
 const registry=createKnowledgeAdapterRegistry();
 const proposal=proposeKnowledgeAdapter({from,to,relation:'equivalent-concept',evidence});
 const r=registry.propose(proposal);
 assert.equal(registry.propose(proposal).id,r.id);
 assert.throws(()=>registry.review(r.id,{approved:true,reviewer:'a',reason:'reviewed'}),/not validated/);
 registry.validate(r.id,{passed:true,checks:['source reviewed','relation checked']});
 const approved=registry.review(r.id,{approved:true,reviewer:'a',reason:'sources compared'});
 assert.equal(approved.state,'approved');
 assert.equal(registry.list({state:'approved'}).length,1);
 assert.equal(JSON.parse(registry.exportJSON()).schema,'math-universe-adapter-registry/v1');
});
test('blocked and failed proposals cannot be approved',()=>{
 const registry=createKnowledgeAdapterRegistry();
 const blocked=registry.propose(proposeKnowledgeAdapter({from,to,relation:'formula-substitution'}));
 registry.validate(blocked.id,{passed:true,checks:['unit check']});
 assert.throws(()=>registry.review(blocked.id,{approved:true,reviewer:'a',reason:'ok'}),/blockers/);
 const failed=registry.propose(proposeKnowledgeAdapter({from,to,relation:'equivalent-concept',evidence}));
 registry.validate(failed.id,{passed:false,checks:['contradiction']});
 assert.throws(()=>registry.review(failed.id,{approved:true,reviewer:'a',reason:'ok'}),/blockers/);
 assert.equal(registry.review(failed.id,{approved:false,reviewer:'a',reason:'contradiction'}).state,'rejected');
});
test('returned adapter records cannot mutate internal state',()=>{
 const registry=createKnowledgeAdapterRegistry();
 const p=proposeKnowledgeAdapter({from,to,relation:'equivalent-concept',evidence});
 const r=registry.propose(p);r.proposal.blockers.push('fake');
 assert.deepEqual(registry.list()[0].proposal.blockers,[]);
});
