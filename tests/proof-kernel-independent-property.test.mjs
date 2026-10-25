import test from 'node:test';
import assert from 'node:assert/strict';
import {
 verifyImplicationProof, verifyImplicationProofJson,
 verifyClosedImplicationProofJson, verifyExpectedClosedImplicationProofJson
} from '../src/proof-kernel.mjs';

// Independent Boolean evaluator; no use of kernel equality or inference helpers.
const atom=name=>({kind:'atom',name});
const imp=(left,right)=>({kind:'imp',left,right});
const P=atom('P'),Q=atom('Q'),R=atom('R');
const value=(f,v)=>f.kind==='atom'?v[f.name]:(!value(f.left,v)||value(f.right,v));
const valuations=Array.from({length:8},(_,bits)=>({P:!!(bits&1),Q:!!(bits&2),R:!!(bits&4)}));
const seed={n:0x7f31a2b5};
function next(){seed.n=(Math.imul(seed.n,1664525)+1013904223)>>>0;return seed.n;}
function formula(depth){if(!depth||next()%3===0)return [P,Q,R][next()%3];return imp(formula(depth-1),formula(depth-1));}
function assumption(index){return {rule:'assumption',index};}
function intro(premise,body){return {rule:'imp_intro',premise,body};}
function elim(fn,arg){return {rule:'imp_elim',fn,arg};}
function allTrueUnder(goal,assumptions){
 return valuations.every(v=>!assumptions.every(a=>value(a,v))||value(goal,v));
}

test('property: 180 seeded identity theorems satisfy independent truth tables',()=>{
 for(let i=0;i<180;i++){
  const a=formula(3),goal=imp(a,a);
  const proof=intro(a,assumption(0));
  const receipt=verifyImplicationProof({goal,proof});
  assert.equal(receipt.isClosedTheorem,true);
  assert.equal(receipt.openAssumptions,0);
  assert.equal(receipt.trustedAxioms,0);
  assert.notEqual(receipt.formalStatus,'VERIFIED');
  assert.equal(allTrueUnder(goal,[]),true);
 }
});

test('property: 180 seeded modus-ponens derivations are semantically valid under assumptions',()=>{
 for(let i=0;i<180;i++){
  const a=formula(2),b=formula(2);
  const assumptions=[imp(a,b),a],proof=elim(assumption(0),assumption(1));
  const receipt=verifyImplicationProof({goal:b,assumptions,proof});
  assert.equal(receipt.isClosedTheorem,false);
  assert.equal(receipt.openAssumptions,2);
  assert.equal(allTrueUnder(b,assumptions),true);
  const json=JSON.stringify({goal:b,assumptions,proof});
  assert.throws(()=>verifyClosedImplicationProofJson(json),/Open assumptions/);
 }
});

test('negative: 180 mutations of exact theorem target must be rejected',()=>{
 for(let i=0;i<180;i++){
  const a=formula(2),goal=imp(a,a),proof=intro(a,assumption(0));
  const substituted=imp(a,imp(a,a));
  assert.throws(()=>verifyImplicationProof({goal:substituted,proof}));
  const doc=JSON.stringify({goal,proof});
  assert.throws(()=>verifyExpectedClosedImplicationProofJson(doc,JSON.stringify(substituted)),/Unexpected theorem goal/);
 }
});

test('negative: malformed inference and open-assumption laundering never claim verification',()=>{
 const bad=[
  {rule:'axiom',statement:P},
  {rule:'assumption',index:-1},
  {rule:'assumption',index:1},
  {rule:'imp_elim',fn:assumption(0),arg:assumption(0)},
  {rule:'imp_intro',premise:P,body:{rule:'axiom',statement:P}}
 ];
 for(const proof of bad)assert.throws(()=>verifyImplicationProof({goal:P,assumptions:[P],proof}));
 const conditional=JSON.stringify({goal:P,assumptions:[P],proof:assumption(0)});
 assert.throws(()=>verifyExpectedClosedImplicationProofJson(conditional,JSON.stringify(P)),/Open assumptions/);
});

test('negative: bounded JSON parser rejects oversized text before parsing',()=>{
 const huge='{'+'x'.repeat(262144);
 assert.throws(()=>verifyImplicationProofJson(huge),/size/);
 const valid=JSON.stringify({goal:imp(P,P),proof:intro(P,assumption(0))});
 assert.equal(verifyClosedImplicationProofJson(valid).isClosedTheorem,true);
 assert.throws(()=>verifyImplicationProofJson(valid.replace('"goal":','"goal":null,"goal":')),/Noncanonical/);
 assert.throws(()=>verifyImplicationProofJson(' '+valid),/Noncanonical/);
});

test('negative: accessors, cycles and prototype control keys fail closed',()=>{
 let called=0;
 const hostile={kind:'atom'};
 Object.defineProperty(hostile,'name',{enumerable:true,get(){called++;return 'P';}});
 assert.throws(()=>verifyImplicationProof({goal:hostile,proof:intro(P,assumption(0))}));
 assert.equal(called,0);
 const cyclic={kind:'imp',left:P};cyclic.right=cyclic;
 assert.throws(()=>verifyImplicationProof({goal:cyclic,proof:intro(P,assumption(0))}));
 for(const name of ['__proto__','constructor','prototype']){
  const doc=JSON.parse('{"goal":{"kind":"atom","name":"P"},"proof":{"rule":"assumption","index":0},"assumptions":[{"kind":"atom","name":"P"}]}');
  Object.defineProperty(doc.proof,name,{value:1,enumerable:true});
  assert.throws(()=>verifyImplicationProof(doc));
 }
});

test('negative: nested live Proxy is rejected before any reflective trap runs',()=>{
 let traps=0;
 const proxy=new Proxy(P,{
  getPrototypeOf(){traps++;throw Error('proxy trap executed');},
  ownKeys(){traps++;throw Error('proxy trap executed');},
  getOwnPropertyDescriptor(){traps++;throw Error('proxy trap executed');}
 });
 assert.throws(()=>verifyImplicationProof({goal:imp(proxy,proxy),proof:intro(P,assumption(0))}),/Invalid input/);
 assert.equal(traps,0);
 assert.throws(()=>verifyImplicationProof(new Proxy({goal:P,proof:assumption(0)},{
  getPrototypeOf(){traps++;throw Error('proxy trap executed');}
 })),/Invalid input/);
 assert.equal(traps,0);
});

test('property: independent truth-table oracle rejects non-entailment examples',()=>{
 const candidates=[P,Q,R,imp(P,Q),imp(Q,R),imp(R,P),imp(P,P),imp(Q,Q)];
 for(const a of candidates)for(const b of candidates){
  const entailed=allTrueUnder(b,[a]);
  const proof=assumption(0);
  if(JSON.stringify(a)===JSON.stringify(b)){
   assert.equal(entailed,true);
   assert.equal(verifyImplicationProof({goal:b,assumptions:[a],proof}).accepted,true);
  }else{
   assert.throws(()=>verifyImplicationProof({goal:b,assumptions:[a],proof}));
  }
 }
});

test('negative: expected-goal entrypoint rejects non-document JSON',()=>{
 for(const input of ['null','[]','42','true']){
  assert.throws(()=>verifyExpectedClosedImplicationProofJson(input,JSON.stringify(P)));
 }
});

test('property: 120 seeded implication-composition proofs are closed and tautological',()=>{
 for(let i=0;i<120;i++){
  const a=formula(2),b=formula(2),c=formula(2);
  const goal=imp(imp(a,b),imp(imp(b,c),imp(a,c)));
  const proof=intro(imp(a,b),intro(imp(b,c),intro(a,
   elim(assumption(1),elim(assumption(0),assumption(2))))));
  const result=verifyImplicationProof({goal,proof});
  assert.equal(result.isClosedTheorem,true);
  assert.equal(result.trustedAxioms,0);
  assert.equal(allTrueUnder(goal,[]),true);
 }
});
test('negative: implication-elimination premise substitution is rejected',()=>{
 for(let i=0;i<100;i++){
  const a=formula(2),b=formula(2),wrong=imp(a,a);
  const assumptions=[imp(a,b),wrong];
  const proof=elim(assumption(0),assumption(1));
  assert.throws(()=>verifyImplicationProof({goal:b,assumptions,proof}),/Invalid implication elimination/);
 }
});

test('negative: wrong implication direction cannot justify consequent',()=>{
 for(let i=0;i<80;i++){
  const a=formula(2),b=formula(2);
  const wrong=imp(b,a);
  const assumptions=[wrong,a];
  const proof=elim(assumption(0),assumption(1));
  if(JSON.stringify(a)!==JSON.stringify(b))
   assert.throws(()=>verifyImplicationProof({goal:b,assumptions,proof}),/Invalid implication elimination/);
 }
});

test('scope: nested introduction preserves outermost indices and rejects swaps',()=>{
 const theorem=imp(P,imp(Q,P));
 const correct={rule:'imp_intro',premise:P,body:{
  rule:'imp_intro',premise:Q,body:{rule:'assumption',index:0}
 }};
 const swapped={rule:'imp_intro',premise:P,body:{
  rule:'imp_intro',premise:Q,body:{rule:'assumption',index:1}
 }};
 assert.equal(verifyImplicationProof({goal:theorem,proof:correct}).isClosedTheorem,true);
 assert.throws(()=>verifyImplicationProof({goal:theorem,proof:swapped}),/Proof does not establish goal/);
 assert.throws(()=>verifyImplicationProof({goal:theorem,proof:{
  ...correct,body:{...correct.body,body:{rule:'assumption',index:2}}
 }}));
});
test('scope: unused top-level assumptions still prevent closed-theorem promotion',()=>{
 const doc=JSON.stringify({goal:imp(P,P),assumptions:[Q],proof:intro(P,{rule:'assumption',index:1})});
 const receipt=verifyImplicationProofJson(doc);
 assert.equal(receipt.isClosedTheorem,false);
 assert.equal(receipt.openAssumptions,1);
 assert.throws(()=>verifyClosedImplicationProofJson(doc),/Open assumptions/);
});

test('negative: no axiom injection or fabricated theorem by untrusted AI',()=>{
 for(let i=0;i<100;i++){
  const a=formula(2),b=formula(2);
  const fabricated={goal:imp(a,b),proof:{rule:'axiom',statement:imp(a,b)}};
  assert.throws(()=>verifyImplicationProof(fabricated));
  const forged={goal:imp(a,b),proof:intro(a,{rule:'assumption',index:1})};
  assert.throws(()=>verifyImplicationProof(forged));
 }
});
test('negative: malformed JSON unicode and number encodings fail closed',()=>{
 const valid=JSON.stringify({goal:imp(P,P),proof:intro(P,assumption(0))});
 for(const text of [valid+' ',valid.replace('"index":0','"index":-0'),valid.replace('"index":0','"index":0.0')]){
  assert.throws(()=>verifyImplicationProofJson(text),/Noncanonical/);
 }
});
