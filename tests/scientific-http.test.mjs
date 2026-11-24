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
  const units=await fetch(url+'/v2/units/describe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'math.units.describe.v1',execution_authority:false,units:['m^2','USD/BTC']})});assert.equal(units.status,200);const info=await units.json();assert.equal(info.schema,'math.units.result.v1');assert.equal(info.units[0].dimensions[0],2);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('HTTP preserves named comparison outputs and rejects nonexistent output ports',async()=>{
 const server=startMathEngine({port:0});await once(server,'listening');const url='http://127.0.0.1:'+server.address().port+'/v2/graph/execute';
 const source=(id,values)=>({id,kind:'source',type:'series',unit:'m',values,timestamps:[1000,2000],availableAt:[1000,2000],provenance:{sourceId:'synthetic',version:'v1',sha256:'a'.repeat(64)}});
 const body={schema:'math.scientific.graph.v2',mode:'HISTORICAL_RESEARCH',execution_authority:false,asOf:2000,nodes:[source('a',[1,2]),source('b',[0,0]),{id:'c',kind:'compare'}],edges:[{from:{node:'a',port:'value'},to:{node:'c',port:'a'}},{from:{node:'b',port:'value'},to:{node:'c',port:'b'}}],outputs:[{node:'c',port:'mae'},{node:'c',port:'rmse'}]};
 try{
  const post=()=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const response=await post();assert.equal(response.status,200);const result=await response.json();assert.equal(result.outputs[0].values[0],1.5);assert.equal(result.outputs[1].type,'scalar');assert.deepEqual(result.outputs[1].availableAt,[2000]);
  body.outputs[0].port='bogus';const bad=await post();assert.equal(bad.status,422);assert.equal((await bad.json()).error,'INVALID_SCIENTIFIC_REQUEST');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
