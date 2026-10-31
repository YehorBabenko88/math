import test from 'node:test';
import assert from 'node:assert/strict';
import {executeScientificGraph} from '../src/scientific-engine.mjs';

test('delayed publication preserves event clocks and waits for the decision cutoff',()=>{
 const graph={schema:'math.scientific.graph.v2',mode:'HISTORICAL_RESEARCH',execution_authority:false,asOf:2500,
  nodes:[{id:'s',kind:'source',type:'series',unit:'m',values:[1,3],timestamps:[1000,2000],availableAt:[1500,2500],
   provenance:{sourceId:'history',version:'v1',sha256:'a'.repeat(64)}},{id:'f',kind:'formula',expression:'x*2',outputUnit:'m'}],
  edges:[{from:{node:'s',port:'value'},to:{node:'f',port:'x'}}],outputs:[{node:'f',port:'value'}]};
 const result=executeScientificGraph(graph).outputs[0];
 assert.deepEqual(result.values,[2,6]);assert.deepEqual(result.timestamps,[1000,2000]);assert.deepEqual(result.availableAt,[1500,2500]);
 assert.throws(()=>executeScientificGraph({...graph,asOf:2499}),/NONCAUSAL/);
});
