import * as fs from 'node:fs';import {basename,join} from 'node:path';
export const mkdirSync=fs.mkdirSync,realpathSync=fs.realpathSync;
const c=JSON.parse(process.env.MU_DETACHED_STAT_CONFIG);let reads=0,detached;
export function lstatSync(path,...args){
 if(basename(String(path))!==c.target)return fs.lstatSync(path,...args);
 reads++;
 if(globalThis.__detachedStatReceipt){globalThis.__detachedStatReceipt.reads=reads;if(reads===c.phase+1)globalThis.__detachedStatReceipt.revalidated=true;}
 if(reads===c.phase){
  fs.writeFileSync(path,Buffer.alloc(512));const fd=fs.openSync(path,'r');
  try{fs.unlinkSync(path);detached=fs.fstatSync(fd);}finally{fs.closeSync(fd);}
  globalThis.__detachedStatReceipt={links:detached.nlink,regular:detached.isFile(),symlink:detached.isSymbolicLink(),size:detached.size,removed:!fs.existsSync(path),reads,revalidated:false};
  if(c.mode==='hardlink'){const other=join(c.directory,'.replacement-target');fs.writeFileSync(other,'');fs.linkSync(other,path);}
  if(c.mode==='regular')fs.writeFileSync(path,'');
  if(c.mode==='oversized'){fs.writeFileSync(path,'');fs.truncateSync(path,33*1024*1024);}
  return detached;
 }
 if(detached&&reads===c.phase+1){
  if(c.mode==='persistent')return detached;
  if(c.mode==='denied')throw Object.assign(Error('Synthetic access denial'),{code:'EACCES'});
  if(c.mode==='symlink'){
   // Exercise the actual filesystem object, not a synthetic Stats shape.
   if(process.platform==='win32'){
    globalThis.__detachedStatReceipt.symlinkEvidence='synthetic-windows';
    return {nlink:1,size:0,isFile:()=>false,isSymbolicLink:()=>true};
   }
   fs.symlinkSync(join(c.directory,'.replacement-target'),path);
   const stat=fs.lstatSync(path,...args);
   globalThis.__detachedStatReceipt.symlinkEvidence=stat.isSymbolicLink()?'real-posix':'invalid';
   return stat;
  }
 }
 return fs.lstatSync(path,...args);
}
