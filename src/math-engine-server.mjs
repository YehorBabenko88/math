import {evaluateUnitRequest} from './scientific-unit-api.mjs';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {evaluateReturnResearch} from './returns-research.mjs';
import {evaluateResearchGraph} from './math-graph-api.mjs';
import {compilePortGraph} from './port-graph.mjs';
import {evaluateFormulaDocument} from './math-formula-api.mjs';
import {executeScientificGraph,scientificCapabilities} from './scientific-engine.mjs';
const MAX_BYTES=262144;
export function decodeMathBody(chunks,expectedLength){
 const bytes=Buffer.concat(chunks);
 if(bytes.length!==expectedLength||bytes.length>MAX_BYTES)throw Error('BODY_LIMIT');
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export function evaluateMathRequest(body) {
 if(!body||typeof body!=='object'||Array.isArray(body)||body.schema!=='math.evaluate.v1'||body.mode!=='HISTORICAL_RESEARCH'||body.execution_authority!==false)
  throw Error('INVALID_CONTRACT');
 if(!Array.isArray(body.closes)||body.closes.length<500||body.closes.length>2000||
   body.closes.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<=0))throw Error('INVALID_CLOSES');
 if(Object.keys(body).sort().join(',')!=='closes,execution_authority,mode,schema')throw Error('UNKNOWN_FIELDS');
 const r=evaluateReturnResearch(body.closes,{windowSize:500,stride:500,lookback:20,
   alphas:[0,.1,.25,.5],maxVolMultiple:2});
 return {schema:'math.result.v1',source:'CALLER_SUPPLIED_UNATTESTED',
  model:'lagged-log-return-mean-v1',windows:r.windows.map(w=>({
   start:w.start,selected:w.selected,alpha:w.alpha,
   trainCount:w.trainCount,validationCount:w.validationCount,testCount:w.testCount,
   validation:w.validation,test:w.test.selected
  })),status:'RESEARCH_ONLY',trading_authorized:false,execution_authority:false,
  training_authorized:false};
}
export function startMathEngine({host='127.0.0.1',port=8788,catalog}={}){
 if(host!=='127.0.0.1'||!Number.isSafeInteger(port)||port<0||port>65535)throw Error('LOOPBACK_ONLY');
 const capabilities=scientificCapabilities(catalog===undefined?{}:{catalog});
 const server=createServer((req,res)=>{
  const reply=(code,obj)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8',
   'cache-control':'no-store','x-content-type-options':'nosniff','access-control-allow-origin':'none'});
   res.end(JSON.stringify(obj))};
  const hostHeader=req.headers.host;
  if(hostHeader!==`127.0.0.1:${server.address().port}`||req.headers.origin) return reply(403,{error:'LOCAL_ORIGIN_REQUIRED'});
  if(req.url==='/healthz'&&req.method==='GET')return reply(200,{service:'math-engine',
   schema:'math.engine.v1',state:'READY_OFFLINE',market_source:'NOT_CONNECTED',trading_authorized:false});
  if(req.url==='/v2/catalog'&&req.method==='GET')return reply(200,capabilities);
  if(!['/v1/evaluate','/v1/graph/execute','/v1/graph/ports','/v1/formula','/v2/graph/execute','/v2/units/describe'].includes(req.url)||req.method!=='POST')return reply(404,{error:'NOT_FOUND'});
  if(req.headers['content-type']!=='application/json')return reply(415,{error:'CONTENT_TYPE'});
  const len=Number(req.headers['content-length']);
  if(!Number.isSafeInteger(len)||len<2||len>MAX_BYTES)return reply(413,{error:'BODY_LIMIT'});
  let count=0;const chunks=[];
  req.setTimeout(5000,()=>{if(!res.headersSent)reply(408,{error:'REQUEST_TIMEOUT'});req.destroy()});
  req.on('error',()=>{});
  req.on('data',chunk=>{count+=chunk.length;if(count>MAX_BYTES){if(!res.headersSent)reply(413,{error:'BODY_LIMIT'});req.destroy();return}chunks.push(chunk)});
  req.on('end',()=>{if(res.writableEnded)return;try{if(count!==len)throw Error('LENGTH_MISMATCH');
   const payload=decodeMathBody(chunks,len);const out=req.url==='/v2/units/describe'?evaluateUnitRequest(payload):req.url==='/v2/graph/execute'?executeScientificGraph(payload,catalog===undefined?{}:{catalog}):req.url==='/v1/formula'?evaluateFormulaDocument(payload):req.url==='/v1/graph/ports'?evaluateResearchGraph(compilePortGraph(payload)):req.url==='/v1/graph/execute'?evaluateResearchGraph(payload):evaluateMathRequest(payload);reply(200,out)}
   catch{reply(422,req.url.startsWith('/v2/')?{schema:'math.error.v2',error:'INVALID_SCIENTIFIC_REQUEST',execution_authority:false,trading_authorized:false}:{error:'INVALID_RESEARCH_REQUEST',trading_authorized:false})}});
 });
 server.maxConnections=8;server.requestTimeout=10000;server.headersTimeout=5000;server.maxRequestsPerSocket=32;
 return server.listen(port,host);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.MATH_ENGINE_PORT??8788);
 startMathEngine({port});
 console.log('MATH_ENGINE_OFFLINE_READY 127.0.0.1:'+port);
}
