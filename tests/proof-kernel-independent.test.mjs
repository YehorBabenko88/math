import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyImplicationProof,verifyExpectedClosedImplicationProofJson} from '../src/proof-kernel.mjs';

const atom = name => ({kind:'atom',name});
const imp = (left,right) => ({kind:'imp',left,right});
const assumption = index => ({rule:'assumption',index});
const intro = (premise,body) => ({rule:'imp_intro',premise,body});
const elim = (fn,arg) => ({rule:'imp_elim',fn,arg});
const P=atom('P'),Q=atom('Q'),R=atom('R');
const evalFormula=(f,v)=>f.kind==='atom'?v[f.name]:(!evalFormula(f.left,v)||evalFormula(f.right,v));
const valuations=[...Array(8)].map((_,n)=>({P:!!(n&1),Q:!!(n&2),R:!!(n&4)}));
const examples=[P,Q,R,imp(P,Q),imp(Q,R),imp(imp(P,Q),R),imp(P,imp(Q,R))];

test('deterministic independent truth-table oracle for generated identity and K theorems',()=>{
 for(const a of examples)for(const b of examples){
  const id={goal:imp(a,a),proof:intro(a,assumption(0))};
  const k={goal:imp(a,imp(b,a)),proof:intro(a,intro(b,assumption(0)))};
  for(const doc of [id,k]){
   const first=verifyImplicationProof(doc);
   assert.equal(first.isClosedTheorem,true);
   assert.deepEqual(verifyImplicationProof(doc),first);
   assert.equal(first.formalStatus,'CHECKED_IN_EXPERIMENTAL_KERNEL');
   for(const v of valuations)assert.equal(evalFormula(doc.goal,v),true);
  }
 }
});

test('implication elimination respects ordered context and changed consequent',()=>{
 for(const a of examples)for(const b of examples){
  const ctx=[imp(a,b),a];
  const proof=elim(assumption(0),assumption(1));
  assert.equal(verifyImplicationProof({goal:b,assumptions:ctx,proof}).isClosedTheorem,false);
  for(const v of valuations)
   if(ctx.every(f=>evalFormula(f,v)))assert.equal(evalFormula(b,v),true);
  assert.throws(()=>verifyImplicationProof({goal:a,assumptions:ctx,proof}));
 }
});

test('scope indices: newest assumption appended, outer assumptions keep their indices',()=>{
 const theorem=imp(P,imp(Q,P));
 assert.equal(verifyImplicationProof({goal:theorem,proof:intro(P,intro(Q,assumption(0)))}).isClosedTheorem,true);
 assert.throws(()=>verifyImplicationProof({goal:theorem,proof:intro(P,intro(Q,assumption(1)))}));
 assert.throws(()=>verifyImplicationProof({goal:theorem,proof:intro(P,intro(Q,assumption(2)))}));
});

test('single-step proof mutations fail closed or prove only explicitly changed claim',()=>{
 const original={goal:imp(P,P),proof:intro(P,assumption(0))};
 const variants=[
  {...original,goal:imp(P,Q)},
  {...original,proof:intro(P,assumption(1))},
  {...original,proof:intro(Q,assumption(0))},
  {...original,proof:{...original.proof,unexpected:1}},
  {...original,proof:elim(assumption(0),assumption(0))},
  {...original,proof:intro(P,{rule:'axiom',formula:P})},
 ];
 for(const changed of variants)assert.throws(()=>verifyImplicationProof(changed));
});

test('expected-goal binding rejects substituted and conditional theorems',()=>{
 const accepted=JSON.stringify({goal:imp(P,P),proof:intro(P,assumption(0))});
 const target=JSON.stringify(imp(P,P));
 assert.equal(verifyExpectedClosedImplicationProofJson(accepted,target).isClosedTheorem,true);
 assert.throws(()=>verifyExpectedClosedImplicationProofJson(accepted,JSON.stringify(imp(P,Q))));
 const conditional=JSON.stringify({goal:P,assumptions:[P],proof:assumption(0)});
 assert.throws(()=>verifyExpectedClosedImplicationProofJson(conditional,JSON.stringify(P)));
});

test('formula shape and array context failures do not rely on success-only sampling',()=>{
 for(const bad of [-1,0.5,2,Number.MAX_SAFE_INTEGER,'0',null])
  assert.throws(()=>verifyImplicationProof({goal:P,assumptions:[P],proof:assumption(bad)}));
 for(const goal of [imp(P,R),imp(Q,P),imp(P,imp(P,P))])
  assert.throws(()=>verifyImplicationProof({goal,proof:intro(P,assumption(0))}));
});

test('bounded depth and immutable replay outcome',()=>{
 let proof=assumption(0),goal=P;
 for(let i=0;i<140;i++){proof=intro(P,proof);goal=imp(P,goal);}
 assert.throws(()=>verifyImplicationProof({goal,proof}));
 const document={goal:imp(P,P),proof:intro(P,assumption(0))};
 const before=JSON.stringify(document);
 for(let i=0;i<25;i++)assert.equal(verifyImplicationProof(document).isClosedTheorem,true);
 assert.equal(JSON.stringify(document),before);
});
