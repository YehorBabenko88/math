import {relative} from 'node:path';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {publicErrorCode,publicFailureType,fixtureCode,publicDiagnosticPhase} from './math-module-diagnostics.mjs';
const inventory=JSON.parse(readFileSync(new URL('./platform-test-inventory.json',import.meta.url),'utf8'));
const trustedHealthIds=new Set(inventory.tests.filter(x=>x.file==='tests/math-engine-module-health.test.mjs'&&x.destination===x.file).map(x=>createHash('sha256').update(JSON.stringify([x.file,x.parent??null,x.name,x.occurrence])).digest('hex')));
// Machine evidence uses actual node:test events; summaries never replace terminal identities.
export default async function* (source) {
 const stack=new Map(),occurrences=new Map(),locations=new Map(),fixtureNotices=new Map();
 for await(const {type,data} of source){
  if(type==='test:start'){
   const file=data.file??data.entryFile;const names=stack.get(file)??[];names[data.nesting]=data.name;names.length=data.nesting+1;stack.set(file,names);
  }
  if(type==='test:pass'||type==='test:fail'){
   const file=data.file??data.entryFile;const names=stack.get(file)??[];
   const parent=data.classname??data.details?.classname??(data.nesting?names.slice(0,data.nesting).join(' > '):null);
   const path=relative(process.cwd(),file).replaceAll('\\','/'),base=JSON.stringify([path,parent,data.name]);
   const occurrence=(occurrences.get(base)??0)+1;occurrences.set(base,occurrence);
   const id=createHash('sha256').update(JSON.stringify([path,parent,data.name,occurrence])).digest('hex');
   locations.set(JSON.stringify([file,data.line,data.column,data.nesting]),{id,failed:type==='test:fail'});
   yield JSON.stringify({type:'terminal',file:path,name:data.name,parent,nesting:data.nesting,line:data.line,column:data.column,status:data.skip?'skip':data.todo?'todo':type==='test:pass'?'pass':data.details?.error?.failureType==='cancelledByParent'?'cancelled':'fail',...(type==='test:fail'?{diagnostic_code:publicErrorCode(data.details?.error),diagnostic_type:publicFailureType(data.details?.error),diagnostic_phase:publicDiagnosticPhase(data.details?.error)}:{})})+'\n';
  }
  if(type==='test:diagnostic'&&data.file&&relative(process.cwd(),data.file).replaceAll('\\','/')==='tests/math-engine-module-health.test.mjs'){
   const code=fixtureCode(data.message),terminal=locations.get(JSON.stringify([data.file,data.line,data.column,data.nesting]));
   if(code&&terminal?.failed&&trustedHealthIds.has(terminal.id)){
    const codes=fixtureNotices.get(terminal.id)??new Set();codes.add(code);fixtureNotices.set(terminal.id,codes);
   }
  }
  if(type==='test:summary'&&!data.file&&!data.entryFile){
   // At most the eight trusted health identities, one bounded notice each.
   for(const [id,codes]of fixtureNotices)process.stderr.write('::notice title=Math fixture public diagnostic::MATH_MODULE_FIXTURE case_id='+id+' codes='+[...codes].join(',')+'\n');
   yield JSON.stringify({type:'summary',success:data.success,counts:data.counts})+'\n';
  }
 }
}
