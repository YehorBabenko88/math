import test from 'node:test';
import assert from 'node:assert/strict';
import {newReplayFilter,observeClaim} from '../src/ai-orchestrator/replay.mjs';
const h='a'.repeat(64);
test('reject repeated task attempt even with changed receipt',()=>{
 const first=observeClaim(newReplayFilter(),{taskId:'a',attempt:1,receiptHash:h});
 assert.throws(()=>observeClaim(first,{taskId:'a',attempt:1,receiptHash:'b'.repeat(64)}),/REPLAY_DETECTED/);
});
test('allow a separate attempt in local filter',()=>{
 const first=observeClaim(newReplayFilter(),{taskId:'a',attempt:1,receiptHash:h});
 assert.equal(observeClaim(first,{taskId:'a',attempt:2,receiptHash:h}).entries.length,2);
});
test('invalid claim rejected',()=>assert.throws(()=>observeClaim(newReplayFilter(),{taskId:'a',attempt:0,receiptHash:h}),/INVALID_REPLAY_KEY/));
test('input filter is immutable',()=>{
 const filter=observeClaim(newReplayFilter(),{taskId:'a',attempt:1,receiptHash:h});
 assert.equal(Object.isFrozen(filter.entries),true);
});
