import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateMathRequest,startMathEngine} from '../src/math-engine-server.mjs';
const series=Array.from({length:500},(_,i)=>70000+20*Math.sin(i*.1)+i*.02);
const request=closes=>({schema:'math.evaluate.v1',mode:'HISTORICAL_RESEARCH',execution_authority:false,closes});
test('single math engine computes with frozen research-only contract',()=>{
 const r=evaluateMathRequest(request(series));assert.equal(r.schema,'math.result.v1');
 assert.equal(r.windows.length,1);assert.equal(r.trading_authorized,false);
 assert.equal(r.training_authorized,false);assert.ok(Number.isFinite(r.windows[0].test.rmse));
});
test('rejects live authority and malformed observations',()=>{
 assert.throws(()=>evaluateMathRequest({...request(series),execution_authority:true}));
 assert.throws(()=>evaluateMathRequest(request([...series.slice(0,499),NaN])));
 assert.throws(()=>evaluateMathRequest({...request(series),order:'BUY'}));
});
