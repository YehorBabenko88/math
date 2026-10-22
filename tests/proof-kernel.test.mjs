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
