// Bounded diagnostic evidence only. Never supplies terminal acceptance or authority.
import {createHash} from 'node:crypto';
export function createEventCapture({append,maxBytes=16*1024*1024}){
 let bytes=0,overflow=false;const chunks=[];
 return {chunk(raw){const value=Buffer.from(raw);if(overflow)return; if(bytes+value.length>maxBytes){overflow=true;return;}append(value);chunks.push(value);bytes+=value.length;},finish(){if(overflow)throw Error('CI_EVENT_BYTES_LIMIT');return Buffer.concat(chunks).toString('utf8');},get bytes(){return bytes;},get overflow(){return overflow;}};
}
export function createCaseProgress({expected,append,snapshot,maxBytes=1024*1024}){
 const planned=new Map(),started=new Map(),finished=new Map(),active=new Set();let bytes=0,starts=0,terminals=0,truncated=false;
 for(const item of expected){const key=JSON.stringify([item.destination??item.file,item.parent??null,item.name]);const list=planned.get(key)??[];list.push(createHash('sha256').update(JSON.stringify([item.file,item.parent??null,item.name,item.occurrence])).digest('hex'));planned.set(key,list);}
 function event(kind,item,counters){
  if(typeof item.file!=='string'||typeof item.name!=='string'||item.file.length>4096||item.name.length>4096||item.parent!==null&&item.parent!==undefined&&(typeof item.parent!=='string'||item.parent.length>4096))return;
  const key=JSON.stringify([item.file,item.parent??null,item.name]),ids=planned.get(key);if(!ids)return;
  const index=counters.get(key)??0;if(index>=ids.length)return;counters.set(key,index+1);const id=ids[index];
  if(kind==='case_start'){active.add(id);starts++;}else{active.delete(id);terminals++;}
  const line=JSON.stringify({type:kind,case_id:id,scope:'DIAGNOSTIC_NOT_TEST_ACCEPTANCE'})+'\n';
  if(bytes+Buffer.byteLength(line)<=maxBytes){append(line);bytes+=Buffer.byteLength(line);}else truncated=true;
  snapshot(JSON.stringify({schema:'math.ci-progress.v1',scope:'DIAGNOSTIC_NOT_TEST_ACCEPTANCE',qualified:false,started:starts,terminal:terminals,active_count:active.size,active_case_ids:[...active].slice(0,64),truncated})+'\n');
 }
 return {start(item){event('case_start',item,started);},terminal(item){event('case_terminal',item,finished);}};
}
