import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{encoding:'utf8',windowsHide:true}).trim();
const expected=process.env.EXPECTED_SOURCE_SHA;
try{
 if(!/^[a-f0-9]{40}$/.test(expected??'')||git('rev-parse','HEAD')!==expected||git('status','--porcelain','--untracked-files=no'))throw Error('SOURCE');
 const tree=git('rev-parse','HEAD^{tree}');
 const inventory=JSON.parse(readFileSync(new URL('./test-inventory.json',import.meta.url)));
 if(!Array.isArray(inventory)||inventory.some(f=>!/^tests\/[a-z0-9-]+\.test\.mjs$/.test(f)))throw Error('INVENTORY');
 const treeEntries=git('ls-tree','-r',expected,'--','src','scripts/scientific','tests','package.json','package-lock.json').split('\n').map(line=>{const [metadata,path]=line.split('\t');const [mode,type,oid]=metadata.split(' ');return {path,mode,type,oid};}).filter(e=>e.path&&(e.path.startsWith('src/')||e.path.startsWith('scripts/scientific/')||e.path.startsWith('tests/')&&/\.(?:mjs|json)$/.test(e.path)||['package.json','package-lock.json'].includes(e.path)));
 const sourceFiles=treeEntries.map(e=>e.path);
 if(inventory.some(f=>!sourceFiles.includes(f)))throw Error('UNCOMMITTED_TEST');
 if(git('ls-files','--others','--exclude-standard','--','src','tests','scripts/scientific'))throw Error('UNTRACKED_SOURCE');
 const batch=execFileSync('git',['--no-replace-objects','cat-file','--batch'],{input:treeEntries.map(e=>e.oid+'\n').join(''),windowsHide:true,maxBuffer:32000000});let offset=0;
 const lf=b=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b).replace(/\r\n/g,'\n');
 for(const e of treeEntries){
  if(!['100644','100755'].includes(e.mode)||e.type!=='blob')throw Error('SOURCE_MODE');
  let current=process.cwd();for(const part of e.path.split('/')){current=join(current,part);if(lstatSync(current).isSymbolicLink())throw Error('SOURCE_LINK');}
  const end=batch.indexOf(10,offset);if(end<0)throw Error('BLOB_HEADER');const [oid,type,sizeText]=batch.subarray(offset,end).toString('ascii').split(' '),size=Number(sizeText);if(oid!==e.oid||type!=='blob'||!Number.isSafeInteger(size)||size<0||end+size+2>batch.length)throw Error('BLOB_HEADER');const committed=batch.subarray(end+1,end+1+size);offset=end+size+2;
  // JS/JSON text checkout EOL equivalence is explicit; raw tested hashes remain recorded.
  // No git filters, index flags, replacements, historical SQL normalization or backfill.
  const bytes=readFileSync(e.path);const equal=/\.(?:mjs|json)$/.test(e.path)?lf(bytes)===lf(committed):bytes.equals(committed);if(!equal)throw Error('SOURCE_BYTES');
 }
 const before=Object.fromEntries(sourceFiles.map(f=>[f,hash(readFileSync(f))]));
 const result=spawnSync(process.execPath,['--test','--test-reporter=tap',...inventory],{env:{...process.env,NODE_TEST_CONTEXT:undefined},encoding:'utf8',timeout:60000,maxBuffer:8000000,windowsHide:true});
 const summary=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(k=>[k,Number(result.stdout?.replace(/\r\n/g,'\n').match(new RegExp('^# '+k+' (\\d+)$','m'))?.[1]??NaN)]));
 const unchanged=sourceFiles.every(f=>before[f]===hash(readFileSync(f)))&&!git('status','--porcelain','--untracked-files=no')&&git('rev-parse','HEAD')===expected;
 const passed=result.status===0&&!result.error&&unchanged&&Number.isSafeInteger(summary.tests)&&summary.tests>0&&summary.pass===summary.tests&&['fail','cancelled','skipped','todo'].every(k=>summary[k]===0);
 const receipt={schema:'math.scientific.test-receipt.v1',sourceSHA:expected,sourceTree:tree,sourceBinding:'COMMITTED_JS_JSON_LF_OTHER_BYTES_EXACT',testedWorktree:unchanged?'TRACKED_BYTES_UNCHANGED':'TRACKED_BYTES_CHANGED',node:process.version,platform:process.platform,summary:Object.fromEntries(Object.entries(summary).map(([k,v])=>[k,Number.isFinite(v)?v:null])),status:passed?'PASS':'FAIL',testLogSHA256:hash(result.stdout??''),stderrSHA256:hash(result.stderr??''),sourceFiles:before,inventory,physical:'NOT_RUN',execution_authority:false};
 mkdirSync('outputs/scientific-engine',{recursive:true});
 const data=JSON.stringify(receipt,null,2)+'\n';writeFileSync('outputs/scientific-engine/receipt.json',data);writeFileSync('outputs/scientific-engine/SHA256SUMS',hash(data)+'  receipt.json\n');
 console.log(JSON.stringify({schema:receipt.schema,status:receipt.status,summary:receipt.summary,sourceSHA:expected,receiptSHA256:hash(data)}));
 if(!passed)process.exitCode=1;
}catch{console.error('SCIENTIFIC_QUALIFICATION_BLOCKED');process.exitCode=1;}
