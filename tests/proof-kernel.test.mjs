import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyImplicationProof} from '../src/proof-kernel.mjs';
const atom=name=>({kind:'atom',name});
const imp=(left,right)=>({kind:'imp',left,right});
const P=atom('P'),Q=atom('Q');
const identity={rule:'imp_intro',premise:P,body:{rule:'assumption',index:0}};
test('proves identity without axioms',()=>{
 const r=verifyImplicationProof({goal:imp(P,P),proof:identity});
 assert.equal(r.accepted,true);
 assert.notEqual(r.formalStatus,'VERIFIED');
});
test('rejects substituted goal',()=>assert.throws(()=>verifyImplicationProof({goal:imp(P,Q),proof:identity})));
test('rejects invented axioms and unknown rules',()=>{
 assert.throws(()=>verifyImplicationProof({goal:P,proof:{rule:'axiom',statement:P}}));
 assert.throws(()=>verifyImplicationProof({goal:P,proof:{rule:'assumption',index:0}}));
});
test('modus ponens with explicit context',()=>{
 const r=verifyImplicationProof({goal:Q,assumptions:[imp(P,Q),P],
 proof:{rule:'imp_elim',fn:{rule:'assumption',index:0},arg:{rule:'assumption',index:1}}});
 assert.equal(r.accepted,true);
});
test('rejects malformed and cyclic objects',()=>{
 const cycle={kind:'imp',left:P};cycle.right=cycle;
 assert.throws(()=>verifyImplicationProof({goal:cycle,proof:identity}));
 assert.throws(()=>verifyImplicationProof({goal:imp(P,P),proof:{...identity,untrusted:true}}));
 assert.throws(()=>verifyImplicationProof({goal:imp(P,P),proof:{rule:'imp_intro',premise:P,body:{rule:'assumption',index:1}}}));
});
test('rejects excessively deep proof',()=>{
 let p={rule:'assumption',index:0};
 for(let i=0;i<150;i++)p={rule:'imp_intro',premise:P,body:p};
 assert.throws(()=>verifyImplicationProof({goal:P,proof:p}));
});

test('rejects getter-backed theorem and proof fields without invoking getters',()=>{
 let calls=0;
 const hostile={kind:'atom'};
 Object.defineProperty(hostile,'name',{enumerable:true,get(){calls++;throw Error('getter executed');}});
 assert.throws(()=>verifyImplicationProof({goal:hostile,proof:identity}));
 const request={proof:identity};
 Object.defineProperty(request,'goal',{enumerable:true,get(){calls++;throw Error('getter executed');}});
 assert.throws(()=>verifyImplicationProof(request));
 assert.equal(calls,0);
});
test('rejects sparse assumption contexts and extra request fields',()=>{
 assert.throws(()=>verifyImplicationProof({goal:imp(P,P),proof:identity,extra:true}));
 const assumptions=new Array(1);
 assert.throws(()=>verifyImplicationProof({goal:imp(P,P),proof:identity,assumptions}));
});

test('rejects nested getter without invoking it',()=>{
 let called=0;
 const premise={kind:'atom'};
 Object.defineProperty(premise,'name',{enumerable:true,get(){called++;return 'P';}});
 assert.throws(()=>verifyImplicationProof({goal:imp(P,P),proof:{rule:'imp_intro',premise,body:{rule:'assumption',index:0}}}));
 assert.equal(called,0);
});
test('rejects nonenumerable fields and prototype-pollution keys',()=>{
 const hidden={...identity};
 Object.defineProperty(hidden,'hidden',{value:1});
 assert.throws(()=>verifyImplicationProof({goal:imp(P,P),proof:hidden}));
 const polluted=JSON.parse('{"rule":"assumption","index":0,"__proto__":{"polluted":true}}');
 assert.throws(()=>verifyImplicationProof({goal:P,assumptions:[P],proof:polluted}));
 assert.equal({}.polluted,undefined);
});
test('rejects cyclic proof input',()=>{
 const proof={rule:'imp_intro',premise:P};
 proof.body=proof;
 assert.throws(()=>verifyImplicationProof({goal:imp(P,P),proof}));
});
