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
 const rootKeys=['schema','read_only','descriptive_only','symbol','timeframe','selection','status','reason','coverage','provenance','execution_authority','trading_authorized','paper_admitted','causal_research_admitted','rows'];
 if(!closed(q,rootKeys))invalid();
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
 const rowKeys=['t','open','high','low','close','volume','turnover','source_declared'];
 const decimal=v=>typeof v==='string'&&v.length<=4300&&/^-?[0-9]+(?:\.[0-9]+)?$/.test(v);
 for(const row of q.rows){if(!closed(row,rowKeys)||
 !['open','high','low','close','volume'].every(k=>decimal(row[k]))||
 !(row.turnover===null||decimal(row.turnover))||
 typeof row.source_declared!=='string'||!/^[A-Za-z0-9_./:-]{1,128}$/.test(row.source_declared)||
 !clock(row.t)||row.t%60000||row.t<q.selection.start_ms||row.t>=q.selection.end_ms||row.t<=previous)invalid();previous=row.t;}
 // Closed legacy test envelope or exact Grid producer envelope; neither attests source.
 const p=q.provenance, minimal=['owner','availability_at_decision','source_authenticity'];
 const full=[...minimal,'dataset','source_declarations','source_revision','raw_frame_sha256','independent_receipt','exchange_completeness','storage_immutability','clock_receipt','numerical_encoding'];
 if(!closed(p,minimal)&&!closed(p,full))invalid();
 if(p.source_authenticity!=='UNATTESTED')invalid();
 if(closed(p,full)){
  const declarations=[...new Set(q.rows.map(row=>row.source_declared))].sort();
  if(p.dataset!=='ohlcv_1m'||p.numerical_encoding!=='POSTGRES_NUMERIC_FIXED_DECIMAL_STRING'||
   p.exchange_completeness!=='NOT_ATTESTED'||p.storage_immutability!=='NOT_ATTESTED'||
   [p.source_revision,p.raw_frame_sha256,p.independent_receipt,p.clock_receipt].some(v=>v!==null)||
   !Array.isArray(p.source_declarations)||declarations.some(v=>typeof v!=='string'||!/^[A-Za-z0-9_./:-]{1,128}$/.test(v))||
   p.source_declarations.length!==declarations.length||declarations.some((v,i)=>v!==p.source_declarations[i]))invalid();
 }
 if(!closed(q.selection,['start_ms','end_ms','as_of_ms','interval_semantics'])||
 !closed(q.coverage,['expected_minutes','observed_minutes','missing_minutes','gaps','basis'])||
 q.coverage.basis!=='LOCAL_STORED_ROW_OBSERVATION_ONLY'||expected>1000)invalid();
 const gaps=[];let cursor=q.selection.start_ms;
 for(const t of [...q.rows.map(row=>row.t),q.selection.end_ms]){
  if(t>cursor)gaps.push({start_ms:cursor,end_ms:t,missing_minutes:(t-cursor)/60000,reason:'MINUTE_NOT_STORED'});
  cursor=t+60000;
 }
 if(q.coverage.gaps.length!==gaps.length||gaps.some((g,i)=>{
  const actual=q.coverage.gaps[i];return !closed(actual,Object.keys(g))||Object.keys(g).some(k=>actual[k]!==g[k]);
 }))invalid();
 const status=q.rows.length===0?'UNAVAILABLE':gaps.length?'GAP':'PARTIAL';
 const reason=status==='UNAVAILABLE'?'NO_STORED_MINUTES':status==='GAP'?'INCOMPLETE_STORED_MINUTES':'SOURCE_AVAILABILITY_NOT_ATTESTED';
 if(q.status!==status||q.reason!==reason)invalid();
 // No stamp conversion, imputation, source receipt, fit or authority is invented.
 return decodeMetadata(encodeMetadata({schema:'math.universe.grid.research.refusal.v1',status:'ABSTAIN',reason:'GRID_AVAILABILITY_UNATTESTED',
  snapshot_ref:semanticDigest(q.schema,q),symbol:q.symbol,requested:q.selection,
  coverage:q.coverage,source_provenance:q.provenance,research:null,
  execution_authority:false,trading_authorized:false}));
}
