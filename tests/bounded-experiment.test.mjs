import test from 'node:test';
import assert from 'node:assert/strict';
import {runBoundedExperiment} from '../src/bounded-experiment.mjs';
const input={schema:'math.evaluate.v1',mode:'HISTORICAL_RESEARCH',execution_authority:false,closes:Array.from({length:500},(_,i)=>100+i*.01)};
test('bounded worker delegates to existing numerical engine',async()=>{const r=await runBoundedExperiment(input);assert.equal(r.schema,'math.result.v1');assert.equal(r.execution_authority,false);assert.equal(r.windows.length,1)});
test('cancel before and during work terminates isolated worker',async()=>{const a=new AbortController();a.abort();await assert.rejects(runBoundedExperiment(input,{signal:a.signal}),/CANCELLED/);const b=new AbortController();const work=runBoundedExperiment(input,{signal:b.signal});b.abort();await assert.rejects(work,/CANCELLED/)});
test('deadline and invalid input fail closed',async()=>{await assert.rejects(runBoundedExperiment(input,{timeoutMs:1}),/DEADLINE_EXCEEDED/);await assert.rejects(runBoundedExperiment({...input,execution_authority:true}),/INVALID_RESEARCH_REQUEST/);await assert.rejects(runBoundedExperiment(input,{timeoutMs:6000}),/INVALID_DEADLINE/)});
