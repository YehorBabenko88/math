// Experimental propositional-implication proof checker. No eval, IO or AI trust.
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
  (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const keys=(o,expected)=>{
 const descriptors=Object.getOwnPropertyDescriptors(o);
 return Reflect.ownKeys(o).length===expected.length&&expected.every(k=>
  own(descriptors,k)&&own(descriptors[k],'value')&&descriptors[k].enumerable);
};
const limit=Object.freeze({nodes:2048,depth:128,context:128});
function inert(o,seen=new Set(),budget={n:0},depth=0){
 if(++budget.n>8192||depth>128)throw Error('Input limit');
 if(o===null||typeof o==='string'||typeof o==='boolean')return o;
 if(typeof o==='number'){
  if(!Number.isFinite(o)||Object.is(o,-0))throw Error('Noncanonical number');
  return o;
 }
 if(typeof o!=='object'||seen.has(o))throw Error('Invalid input');
 const array=Array.isArray(o);
 if(array?Object.getPrototypeOf(o)!==Array.prototype:!record(o))throw Error('Invalid prototype');
 seen.add(o);
 const d=Object.getOwnPropertyDescriptors(o),names=Reflect.ownKeys(d);
 const out=array?[]:Object.create(null);
 if(array){
  const length=d.length.value;
  if(!Number.isSafeInteger(length)||length>2048||names.length!==length+1)throw Error('Invalid array');
  for(let i=0;i<length;i++){
   const v=d[String(i)];
   if(!v||!own(v,'value')||!v.enumerable)throw Error('Invalid element');
   out.push(inert(v.value,seen,budget,depth+1));
  }
 }else for(const k of names){
  if(typeof k!=='string'||k==='__proto__'||k==='constructor'||k==='prototype'||!own(d[k],'value')||!d[k].enumerable)throw Error('Invalid field');
  Object.defineProperty(out,k,{value:inert(d[k].value,seen,budget,depth+1),enumerable:true});
 }
 seen.delete(o);return out;
}

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
function same(a,b){
 const pending=[[a,b]];
 while(pending.length){
  const [left,right]=pending.pop();
  if(left[0]!==right[0])return false;
  if(left[0]==='atom'){
   if(left[1]!==right[1])return false;
  }else pending.push([left[1],right[1]],[left[2],right[2]]);
 }
 return true;
}
export function verifyImplicationProof(untrusted){
 const request=inert(untrusted);
 if(!record(request)||!keys(request,['goal','proof'])&&!keys(request,['goal','proof','assumptions']))throw Error('Invalid request');
 const {goal,proof}=request;
 const assumptions=own(request,'assumptions')?request.assumptions:[];
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
 return Object.freeze({accepted:true,scope:'experimental-propositional-implication/v1',formalStatus:'CHECKED_IN_EXPERIMENTAL_KERNEL',trustedAxioms:0,openAssumptions:ctx.length,isClosedTheorem:ctx.length===0});
}

/**
 * Parse an untrusted JSON document and check its implication proof.
 * This does not execute source text. Callers must enforce transport byte limits
 * before passing large payloads. Only canonical JSON.stringify output is accepted.
 */
export function verifyImplicationProofJson(jsonText){
 if(typeof jsonText!=='string'||Buffer.byteLength(jsonText,'utf8')>262144)
  throw Error('Invalid proof JSON size');
 const parsed=JSON.parse(jsonText);
 if(JSON.stringify(parsed)!==jsonText)throw Error('Noncanonical proof JSON');
 return verifyImplicationProof(parsed);
}

/**
 * Require a closed implication theorem: no top-level hypotheses are permitted.
 * This is still experimental calculus checking, never project-wide VERIFIED.
 */
export function verifyClosedImplicationProofJson(jsonText){
 const result=verifyImplicationProofJson(jsonText);
 if(!result.isClosedTheorem)throw Error('Open assumptions are not a closed theorem');
 return result;
}
