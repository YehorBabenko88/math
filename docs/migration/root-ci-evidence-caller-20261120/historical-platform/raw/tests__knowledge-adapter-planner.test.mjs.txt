import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeKnowledgeAdapter,makeCodexAdapterTask} from '../src/knowledge-adapter-planner.mjs';
const from={id:'kinetic-energy',referenceId:'physics-1990',locator:'p. 80'};
const to={id:'work-energy',referenceId:'mechanics-1973',locator:'p. 45'};
test('proposes nonexecutable sourced adapter with review gate',()=>{
 const proposal=proposeKnowledgeAdapter({from,to,relation:'formula-substitution',assumptions:['classical nonrelativistic mechanics'],evidence:[{id:'e1',referenceId:'textbook',locator:'p. 50'}]});
 assert.equal(proposal.status,'review_required');
 assert.equal(proposal.executable,false);
 assert.deepEqual(proposal.blockers,[]);
 const task=makeCodexAdapterTask(proposal);
 assert.equal(task.task,'propose-declarative-adapter');
 assert.ok(task.constraints.includes('no-eval'));
});
test('blocks unsupported relations and missing evidence',()=>{
 assert.throws(()=>proposeKnowledgeAdapter({from,to,relation:'run-script'}),/Unsupported/);
 const p=proposeKnowledgeAdapter({from,to,relation:'formula-substitution'});
 assert.deepEqual(p.blockers,['missing-independent-evidence','missing-substitution-assumptions']);
 assert.throws(()=>proposeKnowledgeAdapter({from,to:from,relation:'equivalent-concept'}),/Self adapter/);
});
