import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';

const modulePath='../src/book-ingestion/operator-session.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const runId='67f524fc-8c53-4a21-8d7d-b175cdfb938d', resourceId='a'.repeat(64);
const claims=()=>({version:'book-operator-session/v1',issuer:'operator-idp',audience:'book-cutover',subject:'operator-1',sessionId:'session-1',issuedAt:1000,expiresAt:2000,runId,resourceId,scopes:['prepare','quiesce','backup','transfer','verify','activate']});
const load=()=>import(modulePath);
async function fixture(overrides={},key=privateKey){const api=await load();const c={...claims(),...overrides};return {...c,signature:sign(null,api.operatorSessionSigningBytes(c),key).toString('base64url')};}
const options={publicKey,issuer:'operator-idp',audience:'book-cutover',now:()=>1500};
const context={runId,resourceId,scope:'prepare'};

test('accepts an Ed25519 session and exposes only frozen hashed proof',async()=>{
 const api=await load();assert.equal(typeof api.createOperatorSessionVerifier,'function');
 const verifier=api.createOperatorSessionVerifier(options);const proof=verifier.verify(await fixture(),context);
 assert.ok(Object.isFrozen(verifier));assert.ok(Object.isFrozen(proof));assert.deepEqual(Object.keys(proof).sort(),['actorHash','expiresAt','sessionHash']);
 assert.match(proof.actorHash,/^[a-f0-9]{64}$/);assert.match(proof.sessionHash,/^[a-f0-9]{64}$/);assert.equal(proof.expiresAt,2000);
});

test('rejects signature, identity, time and binding failures',async()=>{
 const {createOperatorSessionVerifier}=await load();const verifier=createOperatorSessionVerifier(options);
 for(const changes of [{issuer:'other'},{audience:'other'},{expiresAt:1500},{issuedAt:1501},{issuedAt:0,expiresAt:900001},{issuedAt:1.5},{scopes:['arbitrary']},{subject:'contains spaces'},{sessionId:''},{runId:'no'},{resourceId:'no'},{extra:true}])assert.throws(()=>verifier.verify(awaitedSessions.get(JSON.stringify(changes)),context));
 assert.throws(()=>verifier.verify({...validSession,subject:'changed'},context));
 assert.throws(()=>verifier.verify(wrongKeySession,context));
 for(const change of [{runId:'77f524fc-8c53-4a21-8d7d-b175cdfb938d'},{resourceId:'b'.repeat(64)},{scope:'delete'}])assert.throws(()=>verifier.verify(validSession,{...context,...change}));
 assert.throws(()=>verifier.verify({...validSession,signature:validSession.signature+'='},context));
});
let validSession,wrongKeySession;const awaitedSessions=new Map();
test.before(async()=>{validSession=await fixture();wrongKeySession=await fixture({},generateKeyPairSync('ed25519').privateKey);for(const changes of [{issuer:'other'},{audience:'other'},{expiresAt:1500},{issuedAt:1501},{issuedAt:0,expiresAt:900001},{issuedAt:1.5},{scopes:['arbitrary']},{subject:'contains spaces'},{sessionId:''},{runId:'no'},{resourceId:'no'},{extra:true}])awaitedSessions.set(JSON.stringify(changes),await fixture(changes));});

test('rejects non-inert sessions without invoking accessors or proxy traps',async()=>{
 const {createOperatorSessionVerifier}=await load();const verifier=createOperatorSessionVerifier(options);let touched=0;
 const accessor={...validSession};Object.defineProperty(accessor,'subject',{get(){touched++;throw Error('secret');},enumerable:true});
 const proxy=new Proxy(validSession,{ownKeys(){touched++;throw Error('secret');},getPrototypeOf(){touched++;throw Error('secret');}});
 for(const input of [true,'confirmed',accessor,proxy,{...validSession,scopes:new Proxy([],{getPrototypeOf(){touched++;throw Error('secret');}})}])assert.throws(()=>verifier.verify(input,context));
 assert.equal(touched,0);
});


test('checks current clock and explicit scope on every verification',async()=>{
 const {createOperatorSessionVerifier,operatorSessionSigningBytes}=await load();let time=1500;
 const verifier=createOperatorSessionVerifier({...options,now:()=>time});
 const limited=await fixture({scopes:['prepare']});
 assert.ok(verifier.verify(limited,context));
 assert.throws(()=>verifier.verify(limited,{...context,scope:'activate'}));
 time=2000;assert.throws(()=>verifier.verify(limited,context));
 assert.deepEqual(operatorSessionSigningBytes(claims()),operatorSessionSigningBytes(Object.fromEntries(Object.entries(claims()).reverse())));
 for(const session of [{...validSession,extra:true},{...validSession,scopes:['prepare','prepare']},{...validSession,signature:'x'},'x'.repeat(8193)])assert.throws(()=>verifier.verify(session,context));
});

test('requires an Ed25519 public verification key',async()=>{
 const {createOperatorSessionVerifier}=await load();
 assert.throws(()=>createOperatorSessionVerifier({...options,publicKey:privateKey}));
 assert.throws(()=>createOperatorSessionVerifier({...options,publicKey:generateKeyPairSync('rsa',{modulusLength:2048}).publicKey}));
});
