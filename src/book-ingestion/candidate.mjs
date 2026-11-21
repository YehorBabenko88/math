import {createHash} from 'node:crypto';
import {fromUnit} from '../si-dimensions.mjs';

const ROOT=['schemaVersion','source','locator','extraction','concepts','formulas','claims','evidence','uncertainty'];
const ID=/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/;
const HASH=/^[a-f0-9]{64}$/;
function fail(message){throw new TypeError(message);}
// Descriptor-first bounded copy: never reads source getters, invokes toJSON or follows cycles.
function jsonData(input){
 if(typeof input==='string'){if(input.length>256000)fail('Candidate JSON size limit');input=JSON.parse(input);}
 const active=new Set();let nodes=0,chars=0;
 function copy(value,depth){
  if(++nodes>20000||depth>64)fail('Candidate complexity limit');
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='string'){chars+=value.length;if(value.length>4096||chars>64000)fail('Candidate text size limit');return value;}
  if(typeof value==='number'){if(!Number.isFinite(value))fail('Finite numbers required');return Object.is(value,-0)?0:value;}
  if(typeof value!=='object')fail('Plain JSON data required');
  if(active.has(value))fail('Candidate cycle');active.add(value);
  try{
   const array=Array.isArray(value);if(Object.getPrototypeOf(value)!==(array?Array.prototype:Object.prototype))fail('Plain JSON prototype required');
   if(array&&value.length>256)fail('Array size limit');const keys=Reflect.ownKeys(value);
   if(keys.length>(array?257:32))fail('Object size limit');
   const result=array?[]:{};
   for(const key of keys){
    if(typeof key!=='string'||key.length>128)fail('Invalid JSON key');
    const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!Object.hasOwn(descriptor,'value'))fail('JSON accessors prohibited');
    if(array&&key==='length')continue;
    if(!descriptor.enumerable||array&&!/^(0|[1-9]\d*)$/.test(key))fail('Unexpected JSON property');
    Object.defineProperty(result,key,{value:copy(descriptor.value,depth+1),enumerable:true,writable:true,configurable:true});
   }
   if(array&&result.length!==value.length)fail('Sparse array prohibited');
   if(array)for(let i=0;i<value.length;i++)if(!Object.hasOwn(result,i))fail('Sparse array prohibited');
   return result;
  }finally{active.delete(value);}
 }
 return copy(input,0);
}
function record(value,keys){if(!value||typeof value!=='object'||Array.isArray(value))fail('Object required');for(const k of Object.keys(value))if(!keys.includes(k))fail('Unknown candidate field: '+k);for(const k of keys)if(!Object.hasOwn(value,k))fail('Missing candidate field: '+k);}
function text(value,max=2000){if(typeof value!=='string'||!value.trim()||value.length>max)fail('Invalid candidate text');}
function id(value){if(typeof value!=='string'||!ID.test(value))fail('Invalid structural identifier');}
function hash(value){if(typeof value!=='string'||!HASH.test(value))fail('Invalid SHA256 hash');}
function list(value,max=64){if(!Array.isArray(value)||value.length>max)fail('Candidate list limit');}
function finite(value){if(!Number.isFinite(value))fail('Finite scalar required');}
function fraction(value){finite(value);if(value<0||value>1)fail('Fraction outside 0..1');}
function unit(value){text(value,32);fromUnit(1,value);}
function locator(value){
 record(value,['pdfPage1based','printedPage','region']);if(!Number.isSafeInteger(value.pdfPage1based)||value.pdfPage1based<1)fail('Invalid PDF page');
 if(value.printedPage!==null)text(value.printedPage,128);
 if(value.region!==null){list(value.region,4);if(value.region.length!==4)fail('Invalid normalized region');value.region.forEach(fraction);const [x,y,w,h]=value.region;if(w<=0||h<=0||x+w>1||y+h>1)fail('Invalid normalized region');}
}
function ast(node,symbols,depth=0,count={n:0}){
 if(depth>24||++count.n>128)fail('Formula AST limit');
 if(!node||typeof node!=='object'||Array.isArray(node))fail('Invalid AST');
 if(node.op==='input'){record(node,['op','name']);id(node.name);if(!symbols.has(node.name))fail('Unknown formula input');}
 else if(node.op==='constant'){record(node,['op','value','unit']);finite(node.value);unit(node.unit);}
 else if(node.op==='sqrt'){record(node,['op','value']);ast(node.value,symbols,depth+1,count);}
 else if(['add','subtract','multiply','divide'].includes(node.op)){record(node,['op','left','right']);ast(node.left,symbols,depth+1,count);ast(node.right,symbols,depth+1,count);}
 else fail('Unsupported formula operator');
}
function unique(values,name){const found=new Set();for(const v of values){if(found.has(v))fail('Duplicate '+name);found.add(v);}return found;}
function references(values,known,name){list(values);unique(values,name);for(const value of values){id(value);if(!known.has(value))fail('Unknown '+name+' reference');}}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}

export function validateCandidate(input,{expectedSource,expectedLocator,expectedExtractionVersion,expectedExtractionQuality,expectedTextHash,maxTextChars=2000}={}){
 if(!Number.isSafeInteger(maxTextChars)||maxTextChars<0||maxTextChars>2000)fail('Invalid excerpt policy limit');
 const p=jsonData(input);record(p,ROOT);if(p.schemaVersion!=='knowledge-candidate/v1')fail('Unsupported candidate schema');
 record(p.source,['hash64hex','edition','version','license']);hash(p.source.hash64hex);for(const key of ['edition','version','license'])text(p.source[key],256);
 locator(p.locator);record(p.extraction,['version','quality','textHash64hex']);text(p.extraction.version,128);hash(p.extraction.textHash64hex);
 record(p.extraction.quality,['score','method','needsVisualReview']);fraction(p.extraction.quality.score);if(!['text','ocr','visual'].includes(p.extraction.quality.method)||typeof p.extraction.quality.needsVisualReview!=='boolean')fail('Invalid extraction quality');
 fraction(p.uncertainty);for(const key of ['concepts','formulas','claims','evidence'])list(p[key]);
 let excerpt=0;const prose=value=>{text(value);excerpt+=value.length;};
 for(const c of p.concepts){record(c,['id','label','definition']);id(c.id);prose(c.label);prose(c.definition);}
 for(const f of p.formulas){
  record(f,['id','symbols','outputUnit','ast','assumptions','examples']);id(f.id);list(f.symbols,32);for(const s of f.symbols){record(s,['name','unit']);id(s.name);unit(s.unit);}const symbols=unique(f.symbols.map(s=>s.name),'symbol');unit(f.outputUnit);ast(f.ast,symbols);list(f.assumptions,32);for(const a of f.assumptions)prose(a);
  list(f.examples,64);if(!f.examples.length)fail('Formula examples required');for(const example of f.examples){record(example,['inputs','expected','tolerance']);record(example.inputs,[...symbols]);for(const n of Object.values(example.inputs))finite(n);finite(example.expected);finite(example.tolerance);if(example.tolerance<0||example.tolerance>0.01)fail('Invalid benchmark tolerance');}
 }
 const concepts=unique(p.concepts.map(c=>c.id),'concept'),formulas=unique(p.formulas.map(f=>f.id),'formula'),claims=unique(p.claims.map(c=>c.id),'claim');
 for(const c of p.claims){record(c,['id','text','formulaIds','conceptIds','dependencies','contradictions','uncertainty','status']);id(c.id);prose(c.text);fraction(c.uncertainty);if(c.status!=='untested')fail('Candidate claim must remain untested');references(c.formulaIds,formulas,'formula');references(c.conceptIds,concepts,'concept');references(c.dependencies,claims,'dependency');references(c.contradictions,claims,'contradiction');if(c.contradictions.includes(c.id)||c.dependencies.some(d=>c.contradictions.includes(d)))fail('Invalid self/conflicting claim reference');}
 const visiting=new Set(),visited=new Set(),claimMap=new Map(p.claims.map(c=>[c.id,c]));function visit(claim){if(visiting.has(claim.id))fail('Claim dependency cycle');if(visited.has(claim.id))return;visiting.add(claim.id);claim.dependencies.forEach(d=>visit(claimMap.get(d)));visiting.delete(claim.id);visited.add(claim.id);}p.claims.forEach(visit);
 for(const e of p.evidence){record(e,['id','claimId','locator','note']);id(e.id);id(e.claimId);if(!claims.has(e.claimId))fail('Unknown evidence claim');locator(e.locator);if(e.locator.pdfPage1based!==p.locator.pdfPage1based||e.locator.printedPage!==p.locator.printedPage)fail('Evidence page mismatch');if(p.locator.region!==null){const a=p.locator.region,b=e.locator.region;if(b===null||b[0]<a[0]||b[1]<a[1]||b[0]+b[2]>a[0]+a[2]||b[1]+b[3]>a[1]+a[3])fail('Evidence region outside source locator');}prose(e.note);}
 unique(p.evidence.map(e=>e.id),'evidence');if(excerpt>maxTextChars)fail('Excerpt text policy exceeded');
 if(expectedSource!==undefined){const source=jsonData(expectedSource);for(const k of ['hash64hex','edition','version','license'])if(source[k]!==p.source[k])fail('Source pin mismatch');}
 if(expectedLocator!==undefined&&canonical(jsonData(expectedLocator))!==canonical(p.locator))fail('Locator pin mismatch');
 if(expectedExtractionVersion!==undefined&&expectedExtractionVersion!==p.extraction.version)fail('Extraction version pin mismatch');
 if(expectedExtractionQuality!==undefined&&canonical(jsonData(expectedExtractionQuality))!==canonical(p.extraction.quality))fail('Extraction quality pin mismatch');
 if(expectedTextHash!==undefined&&expectedTextHash!==p.extraction.textHash64hex)fail('Extraction text hash pin mismatch');
 return freeze(p);
}

export function canonicalCandidate(input){return canonical(validateCandidate(input));}
export function hashCandidate(input){return createHash('sha256').update(canonicalCandidate(input),'utf8').digest('hex');}
const same=(a,b)=>a.every((v,i)=>v===b[i]);
function infer(node,symbols){
 if(node.op==='input')return fromUnit(1,symbols.get(node.name)).dimensions;
 if(node.op==='constant')return fromUnit(1,node.unit).dimensions;
 if(node.op==='sqrt'){const d=infer(node.value,symbols);if(d.some(v=>v%2!==0))fail('Fractional sqrt dimensions unsupported');return d.map(v=>v/2);}
 const a=infer(node.left,symbols),b=infer(node.right,symbols);
 if(node.op==='add'||node.op==='subtract'){if(!same(a,b))fail('Incompatible formula dimensions');return a;}
 return a.map((v,i)=>v+(node.op==='multiply'?b[i]:-b[i]));
}
function calculate(node,inputs,symbols){
 let n;if(node.op==='input')n=fromUnit(inputs[node.name],symbols.get(node.name)).siValue;
 else if(node.op==='constant')n=fromUnit(node.value,node.unit).siValue;
 else if(node.op==='sqrt'){const x=calculate(node.value,inputs,symbols);if(x<0)throw Error('non-real-sqrt');n=Math.sqrt(x);}
 else{const a=calculate(node.left,inputs,symbols),b=calculate(node.right,inputs,symbols);if(node.op==='divide'&&b===0)throw Error('division-by-zero');n=node.op==='add'?a+b:node.op==='subtract'?a-b:node.op==='multiply'?a*b:a/b;}
 if(!Number.isFinite(n))throw Error('non-finite');return n;
}
export function verifyCandidate(input,context={}){
 const candidate=validateCandidate(input,context),prepared=candidate.formulas.map(f=>{const symbols=new Map(f.symbols.map(s=>[s.name,s.unit]));if(!same(infer(f.ast,symbols),fromUnit(1,f.outputUnit).dimensions))fail('Formula output dimension mismatch');return {f,symbols};});
 // Infer every formula's dimensions before evaluating any numerical example.
 const examples=prepared.flatMap(({f,symbols})=>f.examples.map((example,index)=>{const base={formulaId:f.id,index,expected:example.expected};try{const actual=calculate(f.ast,example.inputs,symbols)/fromUnit(1,f.outputUnit).siValue;if(!Number.isFinite(actual))throw Error('non-finite');return {...base,actual,passes:Math.abs(actual-example.expected)<=example.tolerance*Math.max(1,Math.abs(example.expected))};}catch(error){return {...base,actual:null,passes:false,error:error.message==='Non-finite quantity'?'non-finite':error.message};}}));
 const q=candidate.extraction.quality;
 return freeze({candidate,digest:hashCandidate(candidate),report:{status:examples.every(e=>e.passes)?'valid':'contradicted',dimensionChecked:true,examples,scope:'numeric-examples-only',requiresVisualReview:q.needsVisualReview||q.method!=='text'||q.score<0.8}});
}
