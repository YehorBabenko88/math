import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FileReplayLedger} from '../src/knowledge/file-replay-ledger.mjs';
test('ledger survives re-instantiation and only one concurrent consume succeeds',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kg-ledger-'));
 try {
  const id='a'.repeat(64);
  const results=await Promise.all(Array.from({length:12},()=>new FileReplayLedger(dir).consume(id)));
  assert.equal(results.filter(Boolean).length,1);
  assert.equal(await new FileReplayLedger(dir).consume(id),false);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('invalid ledger key rejected',async()=>{
 const ledger=new FileReplayLedger(join(tmpdir(),'unused-kg-ledger'));
 await assert.rejects(ledger.consume('../escape'),/invalid request id/);
});
