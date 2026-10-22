import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTask,classifyResult} from '../src/ai-orchestrator/policy.mjs';
const base={schemaVersion:1,taskId:'a-1',kind:'HYPOTHESIS',role:'research',sourceCommit:'a'.repeat(64),inputs:[],budget:{wallSeconds:600,memoryMb:1024,outputMb:50,llmTokens:20000,attempts:2},permissions:{network:false,productionWrite:false,kernelWrite:false}};
test('valid untrusted research task',()=>assert.equal(validateTask(base).kind,'HYPOTHESIS'));
for(const [name,task] of [
 ['role escalation',{...base,role:'publisher'}],
 ['unknown field',{...base,execute:'now'}],
 ['missing permissions',{...base,permissions:undefined}],
 ['production write',{...base,permissions:{...base.permissions,productionWrite:true}}],
 ['network',{...base,permissions:{...base.permissions,network:true}}],
 ['kernel write',{...base,permissions:{...base.permissions,kernelWrite:true}}],
 ['budget overflow',{...base,budget:{...base.budget,attempts:3}}],
 ['missing budget key',{...base,budget:{wallSeconds:600}}],
 ['malformed source',{...base,sourceCommit:'HEAD'}],
 ['release candidate',{...base,kind:'RELEASE_CANDIDATE',role:'publisher'}],
 ['self-asserted approval',{...base,kind:'RELEASE_CANDIDATE',role:'publisher',approval:true}],
 ['input extra keys',{...base,inputs:[{sha256:'b'.repeat(64),trust:'UNTRUSTED',verified:true}]}],
 ['trusted input',{...base,inputs:[{sha256:'b'.repeat(64),trust:'VERIFIED'}]}]
])test(name+' rejected',()=>assert.throws(()=>validateTask(task)));
test('LLM cannot certify',()=>assert.equal(classifyResult({kind:'HYPOTHESIS',proofVerified:true}),'CANDIDATE'));
test('adapter cannot certify',()=>assert.equal(classifyResult({kind:'ADAPTER_BUILD',proofVerified:true}),'ADAPTER_TESTED'));
test('untrusted proof flag cannot certify',()=>assert.equal(classifyResult({kind:'PROOF_CHECK',proofVerified:true}),'CANDIDATE'));
