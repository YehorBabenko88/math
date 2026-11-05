// Build-checkout preparation only: preserve the strict source verifier unchanged.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as fs from 'node:fs';
import {resolve,dirname,join,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';

const need=value=>{if(!value)throw Error('CHECKOUT_PREPARATION_REJECTED');};
const MAX_FILE=16*1024*1024,MAX_TOTAL=128*1024*1024,MAX_FILES=5000;
const blobHash=raw=>createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex');
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.nlink===b.nlink&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
const fold=path=>process.platform==='win32'?path.toLowerCase():path;
function ordinary(path){
 need(isAbsolute(path)&&!path.startsWith('\\\\')&&!path.startsWith('//'));
 for(let cursor=path;;cursor=dirname(cursor)){
  const facts=fs.lstatSync(cursor);need(!facts.isSymbolicLink());
  if(cursor===dirname(cursor))break;
 }
 return fs.lstatSync(path);
}
function readRegular(path){
 const named=ordinary(path);need(named.isFile()&&named.nlink===1&&named.size<=MAX_FILE);
 const fd=fs.openSync(path,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
 try{
  const before=fs.fstatSync(fd);need(same(named,before));
  const raw=Buffer.alloc(before.size+1),count=fs.readSync(fd,raw,0,raw.length,0);
  need(count===before.size&&same(before,fs.fstatSync(fd))&&same(before,ordinary(path)));
  return {raw:raw.subarray(0,count),facts:before};
 }finally{fs.closeSync(fd);}
}
function pathName(raw){
 const name=new TextDecoder('utf-8',{fatal:true}).decode(raw);
 need(Buffer.from(name).equals(raw)&&name.length>0&&name.length<4096&&!/[\\:\x00-\x1f\x7f]/.test(name));
 need(name.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!/^\.git$/i.test(part)&&!/[. ]$/.test(part)&&!/^(?:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)/i.test(part)));
 return name;
}
function equivalent(raw,expected){
 if(raw.equals(expected))return true;
 if(raw.includes(0))return false;
 let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);}catch{return false;}
 return !/(?<!\r)\n|\r(?!\n)/.test(text)&&Buffer.from(text.replaceAll('\r\n','\n')).equals(expected);
}

export function prepareExactCheckout({root=process.cwd(),expectedHead}){
 need(typeof root==='string'&&isAbsolute(root)&&/^[0-9a-f]{40}$/.test(expectedHead??''));
 root=resolve(root);need(ordinary(root).isDirectory()&&ordinary(join(root,'.git')).isDirectory());
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('GIT_')));
 Object.assign(env,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0'});
 const git=(...args)=>execFileSync('git',['--no-replace-objects','-c','core.fsmonitor=false','-c','core.hooksPath='+(process.platform==='win32'?'NUL':'/dev/null'),'-C',root,...args],{env,timeout:15000,maxBuffer:MAX_TOTAL+2*1024*1024,windowsHide:true,stdio:['pipe','pipe','pipe']});
 const identity=()=>{
  need(git('rev-parse','HEAD').toString().trim()===expectedHead);
  need(fold(fs.realpathSync.native(git('rev-parse','--show-toplevel').toString().trim()))===fold(fs.realpathSync.native(root)));
 };
 identity();
 const tree=git('ls-tree','-rlz','--full-tree',expectedHead),entries=[],names=new Set();let total=0;
 for(const record of tree.toString('utf8').split('\0')){
  if(!record)continue;
  const match=/^(100644|100755) blob ([0-9a-f]{40}) +([0-9]+)\t(.+)$/s.exec(record);need(match);
  const [,mode,oid,sizeText,nameText]=match,name=pathName(Buffer.from(nameText)),size=Number(sizeText);
  need(!names.has(name.toLowerCase()));names.add(name.toLowerCase());
  need(Number.isSafeInteger(size)&&size<=MAX_FILE);total+=size;need(total<=MAX_TOTAL&&entries.length<MAX_FILES);
  entries.push({mode,oid,size,name,path:join(root,...name.split('/'))});
 }
 need(entries.length>0);
 const expectedIndex=Buffer.from(entries.map(({mode,oid,name})=>mode+' '+oid+' 0\t'+name+'\0').join(''));
 const index=git('ls-files','--stage','-z');need(index.equals(expectedIndex));
 const unique=[...new Set(entries.map(entry=>entry.oid))],input=Buffer.from(unique.join('\n')+'\n');
 const batch=execFileSync('git',['--no-replace-objects','-c','core.fsmonitor=false','-C',root,'cat-file','--batch'],{input,env,timeout:15000,maxBuffer:MAX_TOTAL+2*1024*1024,windowsHide:true,stdio:['pipe','pipe','pipe']});
 const blobs=new Map();let offset=0;
 for(const oid of unique){
  const end=batch.indexOf(10,offset);need(end>=offset);
  const match=/^([0-9a-f]{40}) blob ([0-9]+)$/.exec(batch.subarray(offset,end).toString('ascii'));need(match&&match[1]===oid);
  const size=Number(match[2]);need(Number.isSafeInteger(size)&&size<=MAX_FILE);
  offset=end+1;const raw=batch.subarray(offset,offset+size);offset+=size;need(raw.length===size&&batch[offset++]===10&&blobHash(raw)===oid);blobs.set(oid,raw);
 }
 need(offset===batch.length);
 // Validate the entire tree before changing even one checkout file.
 for(const entry of entries){
  entry.expected=blobs.get(entry.oid);need(entry.expected.length===entry.size);
  const current=readRegular(entry.path);need(equivalent(current.raw,entry.expected));Object.assign(entry,current);
 }
 identity();need(git('ls-files','--stage','-z').equals(index));
 let rewritten=0;
 for(const entry of entries){
  if(entry.raw.equals(entry.expected))continue;
  const named=ordinary(entry.path);need(same(entry.facts,named));
  const fd=fs.openSync(entry.path,fs.constants.O_RDWR|(fs.constants.O_NOFOLLOW??0));
  try{
   need(same(entry.facts,fs.fstatSync(fd)));
   const current=Buffer.alloc(entry.raw.length+1),count=fs.readSync(fd,current,0,current.length,0);
   need(count===entry.raw.length&&current.subarray(0,count).equals(entry.raw)&&same(entry.facts,ordinary(entry.path)));
   let written=0;while(written<entry.expected.length){const count=fs.writeSync(fd,entry.expected,written,entry.expected.length-written,written);need(count>0);written+=count;}
   fs.ftruncateSync(fd,entry.expected.length);fs.fsyncSync(fd);rewritten++;
  }finally{fs.closeSync(fd);}
 }
 identity();need(git('ls-files','--stage','-z').equals(index));
 for(const entry of entries)need(readRegular(entry.path).raw.equals(entry.expected));
 return {schema:'math.exact-checkout-preparation.v1',head:expectedHead,files:entries.length,rewritten};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{need(process.argv.length===4&&process.argv[2]==='--expected-head');console.log(JSON.stringify(prepareExactCheckout({expectedHead:process.argv[3]})));}
 catch{console.error('CHECKOUT_PREPARATION_REJECTED');process.exitCode=1;}
}
