// One fixed host seam: A codec -> I/C/E Python composition -> M applicability.
// Inputs remain source-unattested. No caller callbacks, imports, commands or grants.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {encodeMetadata,decodeMetadata,decodeBinary64Hex,semanticDigest} from './math-universe-codec.mjs';
import {assessStructuralApplicability} from './method-applicability.mjs';

const worker=fileURLToPath(new URL('../scripts/research-engine-worker.py',import.meta.url));
const ceilings=Object.freeze({max_ops:1000000000,max_read_bytes:16777216,max_write_bytes:16777216,max_live_bytes:67108864,max_output_bytes:262144});
const fail=()=>{throw Error('INVALID_RESEARCH_REQUEST');};
const closed=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const clock=x=>Number.isSafeInteger(x)&&x>=0;
const id=x=>typeof x==='string'&&/^[\x21-\x7e]{1,128}$/.test(x);
function admit(input){
 const q=decodeMetadata(encodeMetadata(input));
 const required=['schema','start_ms','end_ms','as_of_ms','cadence_ms','roster','rows'];
 if(!closed(q,Object.hasOwn(q??{},'budget')?[...required,'budget']:required)||q.schema!=='math.universe.research.request.v1')fail();
 if(![q.start_ms,q.end_ms,q.as_of_ms,q.cadence_ms].every(clock)||q.cadence_ms===0||q.start_ms>=q.end_ms||
 (q.end_ms-q.start_ms)%q.cadence_ms!==0||(q.end_ms-q.start_ms)/q.cadence_ms>256)fail();
 if(!Array.isArray(q.roster)||![4,32].includes(q.roster.length)||!q.roster.every(id)||new Set(q.roster).size!==q.roster.length||!Array.isArray(q.rows)||q.rows.length>8192)fail();
 for(const r of q.rows){
  if(!closed(r,['series','epoch','end_ms','available_ms','revision','value_bits'])||!q.roster.includes(r.series)||!id(r.epoch)||
  ![r.end_ms,r.available_ms,r.revision].every(clock)||r.available_ms<r.end_ms)fail();
  try{decodeBinary64Hex(r.value_bits);}catch{fail();}
 }
 if(q.budget!==undefined){if(!closed(q.budget,Object.keys(ceilings)))fail();
 for(const [key,max] of Object.entries(ceilings))if(!clock(q.budget[key])||q.budget[key]>max)fail();}
 return {...q,budget:q.budget??ceilings};
}
function execute(q){
 return new Promise((resolve,reject)=>{
  const child=spawn('python',['-I','-B',worker],{windowsHide:true,stdio:['pipe','pipe','pipe'],shell:false});
  let size=0,done=false;const parts=[];
  const finish=(err,value)=>{if(done)return;done=true;clearTimeout(timer);err?reject(err):resolve(value);};
  const timer=setTimeout(()=>{child.kill();finish(Error('RESEARCH_TIMEOUT'));},15000);
  child.on('error',()=>finish(Error('RESEARCH_RUNTIME_UNAVAILABLE')));
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>262144){child.kill();finish(Error('RESEARCH_OUTPUT_LIMIT'));}else parts.push(chunk);});
  // Stderr is drained without exposing environment details to result consumers.
  child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
  child.on('close',code=>{if(done)return;try{
   const value=decodeMetadata(Buffer.concat(parts));
   if(code!==0||value.error){finish(Error(value.error==='BUDGET_EXCEEDED'?'BUDGET_EXCEEDED':'RESEARCH_REFUSED'));return;}
   finish(null,value);
  }catch{finish(Error('RESEARCH_INVALID_RESULT'));}});
  child.stdin.end(encodeMetadata(q));
 });
}
export async function runResearchBridge(input){
 const q=admit(input),research=await execute(q);
 let applicability=null;
 if(!research.gaps.length&&research.geometry){
  const support=research.alignment.support;
  applicability=assessStructuralApplicability({schema:'math.method.structural.request.v1',
   sampleIds:support.map(([stamp])=>String(stamp)),eventMs:support.map(([stamp])=>stamp),
   rowsBits:support.map(([,row])=>row.map(v=>v.binary64)),cadenceMs:q.cadence_ms});
 }
 const result={schema:'math.universe.research.bridge.result.v1',status:'ABSTAIN',
  execution_authority:false,trading_authorized:false,source_authenticity:'UNATTESTED',
  requested:research.requested,request_ref:semanticDigest(q.schema,q),research,applicability};
 // The outbound public DTO has the same canonical byte/type bounds as input.
 const encoded=encodeMetadata(result);
 if(encoded.length>research.logical_budget.output_bytes||encoded.length>q.budget.max_output_bytes)throw Error('BUDGET_EXCEEDED');
 return decodeMetadata(encoded);
}

// B's existing Grid route is deliberately descriptive: legacy storage has no
// per-row decision-time availability receipt. Preserve that absence verbatim.
export function inspectGridResearchSnapshot(input){
 const q=decodeMetadata(encodeMetadata(input));
 const invalid=()=>{throw Error('GRID_RESEARCH_SCHEMA');};
 if(!q||q.schema!=='grid.ohlcv_1m.descriptive.v1'||q.read_only!==true||q.descriptive_only!==true||
 q.timeframe!=='1m'||typeof q.symbol!=='string'||!/^[A-Z0-9]{2,30}$/.test(q.symbol)||
 q.execution_authority!==false||q.trading_authorized!==false||q.paper_admitted!==false||q.causal_research_admitted!==false||
 !q.selection||q.selection.interval_semantics!=='HALF_OPEN_UTC_MS'||
 ![q.selection.start_ms,q.selection.end_ms,q.selection.as_of_ms].every(clock)||
 q.selection.start_ms>=q.selection.end_ms||q.selection.end_ms>q.selection.as_of_ms||
 q.selection.start_ms%60000||q.selection.end_ms%60000||
 !q.provenance||q.provenance.owner!=='Grid'||q.provenance.availability_at_decision!=='UNATTESTED'||
 !q.coverage||!Array.isArray(q.coverage.gaps)||!Array.isArray(q.rows)||q.rows.length>256)invalid();
 const expected=(q.selection.end_ms-q.selection.start_ms)/60000;
 if(q.coverage.expected_minutes!==expected||q.coverage.observed_minutes!==q.rows.length||
 q.coverage.missing_minutes!==expected-q.rows.length)invalid();
 let previous=q.selection.start_ms-1;
 for(const row of q.rows){if(!row||!clock(row.t)||row.t%60000||row.t<q.selection.start_ms||row.t>=q.selection.end_ms||row.t<=previous)invalid();previous=row.t;}
 // No stamp conversion, imputation, source receipt, fit or authority is invented.
 return decodeMetadata(encodeMetadata({schema:'math.universe.grid.research.refusal.v1',status:'ABSTAIN',reason:'GRID_AVAILABILITY_UNATTESTED',
  snapshot_ref:semanticDigest(q.schema,q),symbol:q.symbol,requested:q.selection,
  coverage:q.coverage,source_provenance:q.provenance,research:null,
  execution_authority:false,trading_authorized:false}));
}
