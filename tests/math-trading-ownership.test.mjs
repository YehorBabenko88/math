import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeMathBody,evaluateMathRequest,rejectTradingOwnership} from '../src/math-engine-server.mjs';
const series=Array.from({length:500},(_,i)=>70000+20*Math.sin(i*.1)+i*.02);
const request=closes=>({schema:'math.evaluate.v1',mode:'HISTORICAL_RESEARCH',execution_authority:false,closes});
test('Stage9 Math research request refuses PnL, strategy execution and paper positions',()=>{
 for(const body of [
   {...request(series),feeRate:'0.001'},
   {...request(series),pnl:123},
   {...request(series),nested:{virtual_positions:[{quantity:'1'}]}},
   {...request(series),study:{stats:{slippageBps:'2'}}},
   {...request(series),mode:'PAPER_TRADING'},
   {...request(series),research:{paper_orders:[{id:'o1'}]}},
 ]){
   assert.throws(()=>rejectTradingOwnership(body),/TERMINAN_TRADING_OWNER_ONLY/);
   assert.throws(()=>evaluateMathRequest(body));
   const bytes=Buffer.from(JSON.stringify(body));
   assert.throws(()=>decodeMathBody([bytes],bytes.length),/TERMINAN_TRADING_OWNER_ONLY/);
 }
 const pure={schema:'math.research.observations.v1',kind:'SCIENTIFIC_RESEARCH',
   values:[{market_trade_price:'100',volume:'3',timestamp_ms:1}],
   statistics:{volatility:0.2,confidence_interval:[-1,1]},
   geometry:{positions:[[0,0,0],[1,2,3]],orders:[2,3,4]}};
 assert.equal(rejectTradingOwnership(pure),pure);
});
