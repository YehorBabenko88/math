import test from 'node:test';
import assert from 'node:assert/strict';
import {runBoundedExperiment} from '../src/bounded-experiment.mjs';
const input={schema:'math.evaluate.v1',mode:'HISTORICAL_RESEARCH',execution_authority:false,closes:Array.from({length:500},(_,i)=>100+i*.01)};
test('bounded worker delegates to existing numerical engine',async()=>{const r=await runBoundedExperiment(input);assert.equal(r.schema,'math.result.v1');assert.equal(r.execution_authority,false);assert.equal(r.windows.length,1)});
test('cancel before and during work terminates isolated worker',async()=>{const a=new AbortController();a.abort();await assert.rejects(runBoundedExperiment(input,{signal:a.signal}),/CANCELLED/);const b=new AbortController();const work=runBoundedExperiment(input,{signal:b.signal});b.abort();await assert.rejects(work,/CANCELLED/)});
test('deadline and invalid input fail closed',async()=>{await assert.rejects(runBoundedExperiment(input,{timeoutMs:1}),/DEADLINE_EXCEEDED/);await assert.rejects(runBoundedExperiment({...input,execution_authority:true}),/INVALID_RESEARCH_REQUEST/);await assert.rejects(runBoundedExperiment(input,{timeoutMs:6000}),/INVALID_DEADLINE/)});

test('admission limits simultaneous workers',async()=>{const controllers=Array.from({length:4},()=>new AbortController());const work=controllers.map(c=>runBoundedExperiment(input,{signal:c.signal}).catch(e=>e));await assert.rejects(runBoundedExperiment(input),/CAPACITY_UNAVAILABLE/);controllers.forEach(c=>c.abort());await Promise.all(work)});
import {once} from 'node:events';
import {startMathEngine} from '../src/math-engine-server.mjs';
test('loopback HTTP bounded API executes and rejects authority',async()=>{const port=20000+Math.floor(Math.random()*20000),server=startMathEngine({port});await once(server,'listening');try{const send=body=>fetch(`http://127.0.0.1:${port}/v1/experiments`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});let r=await send(input);assert.equal(r.status,200);assert.equal((await r.json()).execution_authority,false);r=await send({...input,execution_authority:true});assert.equal(r.status,422);r=await fetch(`http://127.0.0.1:${port}/healthz`);assert.equal((await r.json()).trading_authorized,false)}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}});
