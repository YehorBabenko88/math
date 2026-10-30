import {relative} from 'node:path';
// Machine evidence uses actual node:test events; summaries never replace terminal identities.
export default async function* (source) {
 const stack=new Map();
 for await(const {type,data} of source){
  if(type==='test:start'){
   const file=data.file??data.entryFile;const names=stack.get(file)??[];names[data.nesting]=data.name;names.length=data.nesting+1;stack.set(file,names);
  }
  if(type==='test:pass'||type==='test:fail'){
   const file=data.file??data.entryFile;const names=stack.get(file)??[];
   yield JSON.stringify({type:'terminal',file:relative(process.cwd(),file).replaceAll('\\','/'),name:data.name,parent:data.classname??data.details?.classname??(data.nesting?names.slice(0,data.nesting).join(' > '):null),nesting:data.nesting,line:data.line,column:data.column,status:data.skip?'skip':data.todo?'todo':type==='test:pass'?'pass':data.details?.error?.failureType==='cancelledByParent'?'cancelled':'fail'})+'\n';
  }
  if(type==='test:summary'&&!data.file&&!data.entryFile)yield JSON.stringify({type:'summary',success:data.success,counts:data.counts})+'\n';
 }
}
