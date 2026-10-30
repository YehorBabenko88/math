import test from 'node:test';
import assert from 'node:assert/strict';
import {startMathEngine,decodeMathBody} from '../src/math-engine-server.mjs';
import {once} from 'node:events';
test('strict UTF8 decode is independent of chunk boundaries and rejects corrupt bytes',()=>{
 const b=Buffer.from('{"sourceId":"математика"}');
 for(let i=1;i<b.length;i++)assert.deepEqual(decodeMathBody([b.subarray(0,i),b.subarray(i)],b.length),{sourceId:'математика'});
 assert.throws(()=>decodeMathBody([Buffer.from([0x7b,0x22,0x78,0x22,0x3a,0x22,0xff,0x22,0x7d])],9));
});
test('versioned loopback API exposes capabilities and executes bounded graphs only',async()=>{
 const server=startMathEngine({port:0});await once(server,'listening');
 const url='http://127.0.0.1:'+server.address().port;
 try{
  const response=await fetch(url+'/v2/catalog');assert.equal(response.status,200);const cap=await response.json();assert.equal(cap.schema,'math.scientific.capabilities.v2');assert.equal(cap.execution_authority,false);assert.ok(cap.units.includes('m'));
  const body={schema:'math.scientific.graph.v2',mode:'HISTORICAL_RESEARCH',execution_authority:false,asOf:1,nodes:[{id:'s',kind:'source',type:'scalar',unit:'m',value:2,timestamp:1,availableAt:1,provenance:{sourceId:'synthetic',version:'v1',sha256:'a'.repeat(64)}}],edges:[],outputs:[{node:'s',port:'value'}]};
  const post=()=>fetch(url+'/v2/graph/execute',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const good=await post();assert.equal(good.status,200);assert.equal((await good.json()).schema,'math.scientific.result.v2');
  body.execution_authority=true;const bad=await post();assert.equal(bad.status,422);assert.deepEqual(await bad.json(),{schema:'math.error.v2',error:'INVALID_SCIENTIFIC_REQUEST',execution_authority:false,trading_authorized:false});
  const origin=await fetch(url+'/v2/catalog',{headers:{origin:'https://example.test'}});assert.equal(origin.status,403);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
