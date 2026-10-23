import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyImplicationProof,verifyImplicationProofJson} from '../src/proof-kernel.mjs';
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

test('rejects reserved object keys',()=>{
 for(const key of ['constructor','prototype']){
  const p={rule:'assumption',index:0};
  Object.defineProperty(p,key,{value:'unexpected',enumerable:true});
  assert.throws(()=>verifyImplicationProof({goal:P,assumptions:[P],proof:p}));
 }
});
test('successful local proof never claims global verification',()=>{
 const result=verifyImplicationProof({goal:imp(P,P),proof:identity});
 assert.equal(result.trustedAxioms,0);
 assert.equal(result.formalStatus,'CHECKED_IN_EXPERIMENTAL_KERNEL');
});

test('reports conditional proofs separately from closed theorems',()=>{
 const conditional=verifyImplicationProof({goal:Q,assumptions:[imp(P,Q),P],proof:{
  rule:'imp_elim',fn:{rule:'assumption',index:0},arg:{rule:'assumption',index:1}
 }});
 assert.equal(conditional.openAssumptions,2);
 assert.equal(conditional.isClosedTheorem,false);
 const closed=verifyImplicationProof({goal:imp(P,P),proof:identity});
 assert.equal(closed.openAssumptions,0);
 assert.equal(closed.isClosedTheorem,true);
});
test('rejects excessive input nesting before inference',()=>{
 let goal=P;
 for(let i=0;i<150;i++)goal=imp(P,goal);
 assert.throws(()=>verifyImplicationProof({goal,proof:identity}));
});

test('rejects noncanonical numeric values at input boundary',()=>{
 for(const index of [NaN,Infinity,-Infinity,-0]){
  assert.throws(()=>verifyImplicationProof({goal:P,assumptions:[P],proof:{rule:'assumption',index}}));
 }
});

test('structural comparison rejects altered nested implication',()=>{
 const nested=imp(P,imp(Q,P));
 const proof={rule:'imp_intro',premise:P,body:{
  rule:'imp_intro',premise:Q,body:{rule:'assumption',index:0}
 }};
 const accepted=verifyImplicationProof({goal:nested,proof});
 assert.equal(accepted.isClosedTheorem,true);
 assert.throws(()=>verifyImplicationProof({goal:imp(P,imp(Q,Q)),proof}));
});

test('iterative formula equality preserves nested implication checks',()=>{
 const theorem=imp(P,imp(Q,P));
 const proof={rule:'imp_intro',premise:P,body:{
  rule:'imp_intro',premise:Q,body:{rule:'assumption',index:0}
 }};
 assert.equal(verifyImplicationProof({goal:theorem,proof}).isClosedTheorem,true);
 assert.throws(()=>verifyImplicationProof({goal:imp(P,imp(P,Q)),proof}));
});

test('soundness smoke test against independent Boolean truth tables',()=>{
 const evaluate=(formula,valuation)=>formula.kind==='atom'
  ? valuation[formula.name]
  : !evaluate(formula.left,valuation)||evaluate(formula.right,valuation);
 const valuations=[{P:false,Q:false},{P:false,Q:true},{P:true,Q:false},{P:true,Q:true}];
 const formulas=[P,Q,imp(P,Q),imp(Q,P),imp(P,P),imp(Q,Q)];
 for(const a of formulas){
  const identityProof={rule:'imp_intro',premise:a,body:{rule:'assumption',index:0}};
  const goal=imp(a,a);
  const result=verifyImplicationProof({goal,proof:identityProof});
  assert.equal(result.isClosedTheorem,true);
  for(const valuation of valuations)assert.equal(evaluate(goal,valuation),true);
 }
 for(const a of formulas)for(const b of formulas){
  const result=verifyImplicationProof({goal:b,assumptions:[imp(a,b),a],proof:{
   rule:'imp_elim',fn:{rule:'assumption',index:0},arg:{rule:'assumption',index:1}
  }});
  assert.equal(result.isClosedTheorem,false);
  for(const valuation of valuations){
   if(evaluate(imp(a,b),valuation)&&evaluate(a,valuation))
    assert.equal(evaluate(b,valuation),true);
  }
 }
});

test('JSON entrypoint checks a closed proof without evaluating code',()=>{
 const doc=JSON.stringify({goal:imp(P,P),proof:identity});
 const result=verifyImplicationProofJson(doc);
 assert.equal(result.isClosedTheorem,true);
 assert.equal(result.formalStatus,'CHECKED_IN_EXPERIMENTAL_KERNEL');
});
test('JSON entrypoint rejects malformed, oversized and non-text payloads',()=>{
 for(const value of ['{bad',JSON.stringify({goal:P}), ' '.repeat(262145),null,{}])
  assert.throws(()=>verifyImplicationProofJson(value));
});
test('JSON entrypoint rejects prototype-control fields',()=>{
 const doc='{"goal":{"kind":"atom","name":"P","__proto__":{}},"proof":{"rule":"assumption","index":0},"assumptions":[{"kind":"atom","name":"P"}]}';
 assert.throws(()=>verifyImplicationProofJson(doc));
});

test('JSON entrypoint rejects duplicate keys and noncanonical whitespace',()=>{
 const valid=JSON.stringify({goal:imp(P,P),proof:identity});
 assert.equal(verifyImplicationProofJson(valid).isClosedTheorem,true);
 assert.throws(()=>verifyImplicationProofJson(valid.replace('"goal":','"goal":null,"goal":')));
 assert.throws(()=>verifyImplicationProofJson(' '+valid));
 assert.throws(()=>verifyImplicationProofJson(valid+'\\n'));
});
