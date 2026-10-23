// Crash-resistant, single-host replay ledger. No status promotion.
import {open,mkdir,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve,dirname,parse} from 'node:path';
const idPattern=/^[a-f0-9]{64}$/;
export class FileReplayLedger {
 #dir;
 constructor(directory) {if(typeof directory!=='string'||!directory) throw Error('directory required');this.#dir=directory;}
 async consume(id) {
  if(!idPattern.test(id)) throw Error('invalid request id');
  // Refuse symlinked ancestors, not only a symlink at the final component.
  let ancestor=resolve(this.#dir);
  const root=parse(ancestor).root;
  while(ancestor!==root) {
   try {
    const entry=await lstat(ancestor);
    if(entry.isSymbolicLink()) throw Error('unsafe ledger ancestor');
    if(!entry.isDirectory()) throw Error('non-directory ledger ancestor');
   } catch(error) {
    if(error?.code!=='ENOENT') throw error;
   }
   ancestor=dirname(ancestor);
  }
  await mkdir(this.#dir,{recursive:true,mode:0o700});
  const dirStat=await lstat(this.#dir);
  if(!dirStat.isDirectory()||dirStat.isSymbolicLink()) throw Error('unsafe ledger directory');
  if(process.platform!=='win32') {
   if((dirStat.mode & 0o077)!==0) throw Error('ledger directory is accessible to others');
   if(typeof process.getuid==='function' && dirStat.uid!==process.getuid()) throw Error('ledger directory owner mismatch');
  }
  const path=join(this.#dir,id);
  let handle;
  try {
   handle=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
   await handle.writeFile('CONSUMED\n');
   await handle.sync();
   return true;
  } catch(error) {
   if(error?.code==='EEXIST') return false;
   throw error;
  } finally {if(handle) await handle.close();}
 }
}
