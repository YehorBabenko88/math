import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';

const queueUrl = new URL('../src/book-ingestion/queue.mjs', import.meta.url).href;
const input = {sourceHash:'a'.repeat(64), edition:'QA fixture', page:1, extractionVersion:'qa-v1', payload:{fixture:true}};

function child(directory, workerId) {
  const script = `import {openBookQueue} from ${JSON.stringify(queueUrl)};
const q=await openBookQueue({directory:${JSON.stringify(directory)}});
await q.enqueue(${JSON.stringify(input)});
const lease=await q.acquire({workerId:${JSON.stringify(workerId)},leaseMs:30000});
console.log(JSON.stringify({lease:lease===null?null:{id:lease.id,token:lease.token}}));`;
  return new Promise((resolve,reject)=>{
    const proc=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    const maxOutput=64*1024;
    let overflow=false;
    let timedOut=false;
    const watchdog=setTimeout(()=>{timedOut=true;proc.kill('SIGKILL');},30000);
    watchdog.unref();
    proc.stdout.setEncoding('utf8');proc.stderr.setEncoding('utf8');
    proc.stdout.on('data',v=>{stdout+=v;if(stdout.length>maxOutput){overflow=true;proc.kill();}});
    proc.stderr.on('data',v=>{stderr+=v;if(stderr.length>maxOutput){overflow=true;proc.kill();}});
    proc.on('error',err=>{clearTimeout(watchdog);reject(err);});
    proc.on('close',(code,signal)=>{clearTimeout(watchdog);resolve({code,signal,stdout,stderr,overflow,timedOut});});
  });
}

test('QA Q01: concurrent first-open creators never both fail or acquire duplicate leases', {timeout:600000}, async()=>{
  // A failure is intentionally preserved; no automatic retry, no Q01 closure claim.
  const rounds=Number(process.env.QA_Q01_ROUNDS ?? 20);
  assert.ok(Number.isSafeInteger(rounds)&&rounds>=1&&rounds<=300,'bounded QA_Q01_ROUNDS required');
  const deadline=performance.now()+540000;
  for(let round=0;round<rounds;round++){
    assert.ok(performance.now()<deadline,`Q01 diagnostic budget exhausted before round ${round}/${rounds}`);
    const directory=mkdtempSync(join(tmpdir(),'math-q01-qa-'));
    try {
      const results=await Promise.all([child(directory,'qa-a'),child(directory,'qa-b')]);
      assert.ok(results.every(x=>!x.overflow),'Q01 child output overflow');
      assert.ok(results.every(x=>!x.timedOut),`Q01 child timeout at round ${round}: ${JSON.stringify(results)}`);
      assert.deepEqual(results.map(x=>x.code),[0,0],`Q01 first-open failed at round ${round}: ${JSON.stringify(results)}`);
      const leases=results.map(x=>{
        const lines=x.stdout.trim().split(/\r?\n/);
        assert.equal(lines.length,1,`Q01 unexpected stdout at round ${round}`);
        const response=JSON.parse(lines[0]);
        assert.deepEqual(Object.keys(response),['lease'],`Q01 invalid child response at round ${round}`);
        if(response.lease!==null){
          assert.ok(response.lease&&typeof response.lease==='object'&&!Array.isArray(response.lease),`Q01 malformed lease at round ${round}`);
          assert.deepEqual(Object.keys(response.lease).sort(),['id','token'],`Q01 malformed lease fields at round ${round}`);
          assert.ok(typeof response.lease.id==='string'||Number.isSafeInteger(response.lease.id),`Q01 invalid lease id at round ${round}`);
          assert.ok(typeof response.lease.token==='string'&&response.lease.token.length>0,`Q01 invalid lease token at round ${round}`);
        }
        return response.lease;
      }).filter(Boolean);
      assert.equal(leases.length,1,`Q01 lease uniqueness at round ${round}`);
    } finally {rmSync(directory,{recursive:true,force:true});}
  }
});
