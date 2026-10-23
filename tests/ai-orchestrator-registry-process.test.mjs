import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const moduleUrl=new URL('../src/ai-orchestrator/registry.mjs',import.meta.url).href;
const worker=`
import {openReceiptRegistry} from ${JSON.stringify(moduleUrl)};
const r=openReceiptRegistry(process.argv[1]);
try{
 r.register({taskId:'race',attempt:1,receiptHash:'a'.repeat(64)});
 process.stdout.write('REGISTERED');
}catch(e){
 if(e.message==='REPLAY_DETECTED')process.stdout.write('REPLAY');
 else {process.stderr.write(String(e.stack));process.exitCode=2;}
}finally{r.close();}
`;
function run(file){
 return new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,['--input-type=module','-e',worker,file],{stdio:['ignore','pipe','pipe']});
  let out='',err='';
  p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);
  p.on('error',reject);p.on('close',code=>resolve({code,out,err}));
 });
}
test('eight independent processes contend on first-open and exactly one registers',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ai-race-')),file=join(dir,'registry.sqlite');
 try{
  const results=await Promise.all(Array.from({length:8},()=>run(file)));
  assert.deepEqual(results.map(x=>x.code),Array(8).fill(0),JSON.stringify(results));
  assert.equal(results.filter(x=>x.out==='REGISTERED').length,1,JSON.stringify(results));
  assert.equal(results.filter(x=>x.out==='REPLAY').length,7,JSON.stringify(results));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
