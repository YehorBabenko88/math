import test from 'node:test';
import assert from 'node:assert/strict';
import {createScientificExperimentGraph} from '../src/experiment-graph.mjs';
import {validateGraphNodeEvidence} from '../src/graph-evidence-validation.mjs';
const spec={claim:'Speed conversion example',referenceId:'textbook-kinematics',locator:'section 1',observations:[{expected:10,expectedUnit:'m/s',actual:36,actualUnit:'km/h'}]};
test('validates evidence for an existing graph node without modifying graph',()=>{
 const graph=createScientificExperimentGraph();
 graph.addSource('observations','time-series',[1,2,3],{metadata:{units:'m/s'}});
 const before=graph.exportJSON();
 const result=validateGraphNodeEvidence(graph,'observations',spec);
 assert.equal(result.evidence.status,'reproduced');
 assert.equal(result.nodeType,'time-series');
 assert.equal(graph.exportJSON(),before);
});
test('rejects unknown graph nodes and dimension mismatches',()=>{
 const graph=createScientificExperimentGraph();graph.addSource('x','time-series',[1,2]);
 assert.throws(()=>validateGraphNodeEvidence(graph,'missing',spec),/Unknown experiment node/);
 assert.throws(()=>validateGraphNodeEvidence(graph,'x',{...spec,observations:[{expected:1,expectedUnit:'m',actual:1,actualUnit:'s'}]}),/Incompatible/);
});
