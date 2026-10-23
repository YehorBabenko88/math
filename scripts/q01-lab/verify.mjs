import {readFile,readdir,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const requireValid=(condition,label)=>{if(!condition)throw Error(`Evidence validation failed: ${label}`);};
const xmlEscape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');

function verifySafeData(value, depth=0){
 requireValid(depth<=12,'event data depth');
 if(typeof value==='string'){requireValid(value.length<=256&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value),'event string safety');return;}
 if(value===null||typeof value==='boolean')return;
 if(typeof value==='number'){requireValid(Number.isFinite(value),'event number');return;}
 requireValid(typeof value==='object','event data type');
 for(const [key,item]of Object.entries(value)){requireValid(!/^(payload|token|password|rawsql|path)$/i.test(key)&&key.length<=64,'sensitive event key');verifySafeData(item,depth+1);}
}
function verifyLifecycle(events,results){
 for(const result of results){
  const scoped=events.filter(e=>e.caseId===result.id);
  requireValid(scoped.filter(e=>e.event==='case-start').length===1&&scoped.filter(e=>e.event==='case-end').length===1,'case boundary counts');
  requireValid(scoped[0].event==='case-start'&&scoped.at(-1).event==='case-end'&&scoped.at(-1).data.status===result.status,'case boundary order or status');
  const workers=new Map();
  for(const e of scoped){
   verifySafeData(e.data);
   if(e.event==='case-start'||e.event==='case-end')continue;
   requireValid(['ready','start','barrier','release','phase','result','exit'].includes(e.event),'event kind');
   if(e.workerId==='parent'){requireValid(e.event==='phase','parent event kind');continue;}
   let w=workers.get(e.workerId);if(!w){w={state:'new',barriers:new Map(),elapsed:-1n};workers.set(e.workerId,w);}
   if(e.data.elapsedNs!==undefined){requireValid(typeof e.data.elapsedNs==='string'&&/^\d+$/.test(e.data.elapsedNs)&&BigInt(e.data.elapsedNs)>=w.elapsed,'worker elapsed timeline');w.elapsed=BigInt(e.data.elapsedNs);}
   switch(e.event){
    case 'ready':requireValid(w.state==='new','worker ready order');w.state='ready';break;
    case 'start':requireValid(w.state==='ready','worker start order');w.state='started';break;
    case 'barrier':requireValid(w.state==='started'&&typeof e.data.phase==='string'&&e.data.phase.length&&!w.barriers.has(e.data.phase),'barrier arrival');w.barriers.set(e.data.phase,false);break;
    case 'release':requireValid(w.state==='started'&&w.barriers.get(e.data.phase)===false,'barrier release order');w.barriers.set(e.data.phase,true);break;
    case 'phase':requireValid(w.state==='started','worker phase order');break;
    case 'result':requireValid(w.state==='started'&&[...w.barriers.values()].every(Boolean),'worker result order');w.state='result';break;
    case 'exit':
     if(result.status!=='PASS'&&(e.data.timedOut===true||(Number.isInteger(e.data.code)&&e.data.code!==0))){requireValid(w.state!=='exited','duplicate abnormal exit');}
     else if(e.data.killed===true)requireValid(w.state==='started'&&[...w.barriers.values()].some(released=>!released),'killed worker order');
     else {requireValid(w.state==='result','worker exit order');requireValid(e.data.code===0&&e.data.signal==='none'&&e.data.timedOut!==true,'successful worker termination');}
     w.state='exited';break;
   }
  }
  requireValid(result.status!=='PASS'||workers.size>0,'PASS requires worker evidence');
  requireValid([...workers.values()].every(w=>w.state==='exited'),'worker exit completeness');
  const pairMatch=/^(concurrent-first-open-(10|100|300|1000)|diagnostic-first-open-(100|3000))$/.exec(result.id);
  if(pairMatch){
   const total=Number(pairMatch[2]||pairMatch[3]);
   const pairs=scoped.filter(e=>e.workerId==='parent'&&e.event==='phase'&&e.data.phase==='native-pair');
   requireValid(pairs.length===total&&pairs.every((e,i)=>e.data.iteration===i&&typeof e.data.success==='boolean'),'native pair inventory');
   requireValid(result.status!=='PASS'||pairs.every(e=>e.data.success),'native pair failure cannot PASS');
   const diagnostic=result.id.startsWith('diagnostic');
   requireValid(pairs.every(e=>diagnostic?e.data.lane==='diagnostic-preload':e.data.lane===undefined||e.data.lane==='native'),'native pair lane');
  }
 }
}

export async function verifyEvidence({directory,expectedHead,expectedProfile,expectedCases}){
 requireValid(/^[a-f0-9]{40}$/.test(expectedHead),'expected HEAD');requireValid(typeof expectedProfile==='string'&&expectedProfile.length,'expected profile');requireValid(Array.isArray(expectedCases)&&expectedCases.length&&new Set(expectedCases).size===expectedCases.length,'external case inventory');
 const ds=await lstat(directory);requireValid(ds.isDirectory()&&!ds.isSymbolicLink(),'directory');const names=['events.jsonl','junit.xml','manifest.json','report.json'];requireValid(JSON.stringify((await readdir(directory)).sort())===JSON.stringify(names),'file inventory');
 const data={};for(const name of names){const stat=await lstat(join(directory,name));requireValid(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1,'regular unlinked files');data[name]=await readFile(join(directory,name),'utf8');}
 const manifest=JSON.parse(data['manifest.json']);requireValid(manifest.schemaVersion===1&&manifest.algorithm==='sha256'&&JSON.stringify(Object.keys(manifest.files).sort())===JSON.stringify(['events.jsonl','junit.xml','report.json']),'manifest inventory');for(const [name,hash]of Object.entries(manifest.files))requireValid(/^[a-f0-9]{64}$/.test(hash)&&createHash('sha256').update(data[name]).digest('hex')===hash,'hash mismatch');
 const r=JSON.parse(data['report.json']);requireValid(r.schemaVersion===1&&r.q01Status==='OPEN'&&r.source?.head===expectedHead&&r.profile===expectedProfile,'report identity');requireValid(/^[a-f0-9]{40}$/.test(r.source.tree)&&['queueSha256','contractSha256','textSha256'].every(k=>/^[a-f0-9]{64}$/.test(r.source[k])),'source hashes');
 requireValid(JSON.stringify(r.expectedCases)===JSON.stringify(expectedCases),'case inventory');requireValid(Array.isArray(r.results)&&r.results.length===expectedCases.length&&new Set(r.results.map(c=>c.id)).size===expectedCases.length,'result completeness');
 for(const c of r.results){requireValid(expectedCases.includes(c.id)&&['PASS','FAIL','BLOCKED'].includes(c.status)&&typeof c.reason==='string','case status');requireValid(Array.isArray(c.assertions)&&c.assertions.length&&new Set(c.assertions.map(a=>a.name)).size===c.assertions.length&&c.assertions.every(a=>typeof a.name==='string'&&a.name.length&&typeof a.pass==='boolean'),'assertions');requireValid(c.status!=='PASS'||c.assertions.every(a=>a.pass),'false successful assertion');}
 const status=r.results.some(c=>c.status==='FAIL')?'FAIL':r.results.some(c=>c.status==='BLOCKED')?'BLOCKED':'PASS';requireValid(r.status===status,'overall status');
 requireValid(data['events.jsonl'].endsWith('\n'),'JSONL termination');const events=data['events.jsonl'].trimEnd().split('\n').map(s=>JSON.parse(s));requireValid(events.length===r.eventCount&&events.length>0,'event count');let last=-1n;for(let i=0;i<events.length;i++){const e=events[i];requireValid(e.seq===i+1&&expectedCases.includes(e.caseId)&&typeof e.workerId==='string'&&e.workerId.length&&typeof e.event==='string'&&e.event.length&&typeof e.atNs==='string'&&/^\d+$/.test(e.atNs)&&BigInt(e.atNs)>=last&&e.data&&typeof e.data==='object'&&!Array.isArray(e.data),'event sequence or timeline');last=BigInt(e.atNs);}requireValid(expectedCases.every(id=>events.some(e=>e.caseId===id)),'case event completeness');
 verifyLifecycle(events,r.results);
 const expectedXml=`<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="q01" tests="${r.results.length}" failures="${r.results.filter(c=>c.status!=='PASS').length}" errors="0" skipped="0">\n${r.results.map(c=>`<testcase classname="q01.${xmlEscape(r.profile)}" name="${xmlEscape(c.id)}"><properties>${c.assertions.map(a=>`<property name="${xmlEscape(a.name)}" value="${a.pass}"/>`).join('')}</properties>${c.status==='PASS'?'':`<failure type="${c.status}" message="${xmlEscape(c.reason)}"/>`}</testcase>`).join('\n')}\n</testsuite>\n`;
 requireValid(data['junit.xml']===expectedXml,'JUnit result/assertion consistency');return r;
}
async function main(){const args=process.argv.slice(2),opts={};requireValid(args.length===6,'CLI arguments');for(let i=0;i<args.length;i+=2){requireValid(['--directory','--expected-head','--expected-profile'].includes(args[i])&&!opts[args[i]],'CLI option');opts[args[i]]=args[i+1];}const {expectedCasesForProfile}=await import('./plan.mjs');const report=await verifyEvidence({directory:opts['--directory'],expectedHead:opts['--expected-head'],expectedProfile:opts['--expected-profile'],expectedCases:expectedCasesForProfile(opts['--expected-profile'])});console.log(JSON.stringify({verification:'PASS',status:report.status,q01Status:report.q01Status}));if(report.status!=='PASS')process.exitCode=1;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Evidence verification failed; no payload printed.');process.exitCode=1;});
