import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlan,advance} from '../src/ai-orchestrator/plan.mjs';
const task={schemaVersion:1,taskId:'test-1',kind:'ADAPTER_BUILD',role:'codex',sourceCommit:'a'.repeat(64),inputs:[],budget:{wallSeconds:600,memoryMb:1024,outputMb:50,llmTokens:20000,attempts:2},permissions:{network:false,productionWrite:false,kernelWrite:false}};
const token='abcdefghijklmnop';
test('legal planning sequence never publishes',()=>{
 let p=newPlan(task);p=advance(p,{to:'LEASED',expectedGeneration:0,leaseToken:token});
 p=advance(p,{to:'RUNNING',expectedGeneration:1,leaseToken:token});
 p=advance(p,{to:'TESTED',expectedGeneration:2,leaseToken:token});
 p=advance(p,{to:'REVIEW_REQUIRED',expectedGeneration:3});
 assert.equal(p.state,'REVIEW_REQUIRED');
 assert.throws(()=>advance(p,{to:'VERIFIED',expectedGeneration:4}));
 assert.throws(()=>advance(p,{to:'RELEASED',expectedGeneration:4}));
});
test('stale generation rejected',()=>assert.throws(()=>advance(newPlan(task),{to:'LEASED',expectedGeneration:1,leaseToken:token})));
test('short lease token rejected',()=>assert.throws(()=>advance(newPlan(task),{to:'LEASED',expectedGeneration:0,leaseToken:'x'})));
test('wrong token rejected',()=>{
 const p=advance(newPlan(task),{to:'LEASED',expectedGeneration:0,leaseToken:token});
 assert.throws(()=>advance(p,{to:'RUNNING',expectedGeneration:1,leaseToken:'wrongwrongwrongwrong'}));
});
test('terminal states cannot revive',()=>{
 const p=advance(newPlan(task),{to:'CANCELLED',expectedGeneration:0});
 assert.throws(()=>advance(p,{to:'LEASED',expectedGeneration:1,leaseToken:token}));
});
test('no jump directly from pending to tested',()=>assert.throws(()=>advance(newPlan(task),{to:'TESTED',expectedGeneration:0})));
