// Experimental propositional-implication proof checker. No eval, IO or AI trust.
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
  (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const keys=(o,expected)=>Object.keys(o).length===expected.length&&expected.every(k=>own(o,k));
const limit=Object.freeze({nodes:2048,depth:128,context:128});
function statement(node,state,depth=0){
 if(depth>limit.depth||++state.nodes>limit.nodes||!record(node))throw Error('Invalid statement');
 if(state.active.has(node))throw Error('Cyclic statement');
 state.active.add(node);
 let value;
 if(node.kind==='atom'&&keys(node,['kind','name'])&&typeof node.name==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(node.name))
   value=['atom',node.name];
 else if(node.kind==='imp'&&keys(node,['kind','left','right']))
   value=['imp',statement(node.left,state,depth+1),statement(node.right,state,depth+1)];
 else throw Error('Invalid statement');
 state.active.delete(node);return value;
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function verifyImplicationProof({goal,proof,assumptions=[]}={}){
 const state={nodes:0,active:new Set()};
 if(!Array.isArray(assumptions)||assumptions.length>limit.context)throw Error('Invalid context');
 const target=statement(goal,state);
 const ctx=assumptions.map(a=>statement(a,state));
 function derive(p,env,depth){
  if(depth>limit.depth||++state.nodes>limit.nodes||!record(p)||state.active.has(p))throw Error('Invalid proof');
  state.active.add(p);let result;
  if(p.rule==='assumption'&&keys(p,['rule','index'])&&Number.isInteger(p.index)&&p.index>=0&&p.index<env.length)
   result=env[p.index];
  else if(p.rule==='imp_intro'&&keys(p,['rule','premise','body'])){
   const premise=statement(p.premise,state,depth+1);
   if(env.length>=limit.context)throw Error('Context limit');
   result=['imp',premise,derive(p.body,[...env,premise],depth+1)];
  }else if(p.rule==='imp_elim'&&keys(p,['rule','fn','arg'])){
   const fn=derive(p.fn,env,depth+1),arg=derive(p.arg,env,depth+1);
   if(fn[0]!=='imp'||!same(fn[1],arg))throw Error('Invalid implication elimination');
   result=fn[2];
  }else throw Error('Unknown or malformed inference rule');
  state.active.delete(p);return result;
 }
 const actual=derive(proof,ctx,0);
 if(!same(actual,target))throw Error('Proof does not establish goal');
 return Object.freeze({accepted:true,scope:'experimental-propositional-implication/v1',formalStatus:'CHECKED_IN_EXPERIMENTAL_KERNEL',trustedAxioms:0});
}
