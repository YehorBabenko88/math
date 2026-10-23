// Crash-resistant, single-host replay ledger. No status promotion.
import {open,mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
const idPattern=/^[a-f0-9]{64}$/;
export class FileReplayLedger {
 #dir;
 constructor(directory) {if(typeof directory!=='string'||!directory) throw Error('directory required');this.#dir=directory;}
 async consume(id) {
  if(!idPattern.test(id)) throw Error('invalid request id');
  await mkdir(this.#dir,{recursive:true});
  const path=join(this.#dir,id);
  let handle;
  try {
   handle=await open(path,'wx',0o600);
   await handle.writeFile('CONSUMED\n');
   await handle.sync();
   return true;
  } catch(error) {
   if(error?.code==='EEXIST') return false;
   throw error;
  } finally {if(handle) await handle.close();}
 }
}
