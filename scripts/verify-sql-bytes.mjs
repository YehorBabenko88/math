// Read-only: compare checkout bytes to committed HEAD, never normalize or repair.
// Run before packaging/applying SQL from a Git checkout. No database access.
import {execFileSync} from 'node:child_process';
import {readFileSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
const git=(...args)=>execFileSync('git',args,{maxBuffer:16*1024*1024});
try{
 const root=git('rev-parse','--show-toplevel').toString('utf8').trim();
 process.chdir(root);
 const commit=git('rev-parse','HEAD').toString('ascii').trim();
 const paths=git('ls-tree','-r','--name-only','-z',commit,'--','sql').toString('utf8').split('\0').filter(p=>p.endsWith('.sql'));
 if(!paths.length)throw Error('SQL_CHECKOUT_NO_COMMITTED_SQL');
 const failures=[];
 for(const path of paths){
  const blob=git('show',`${commit}:${path}`);
  try{if(!lstatSync(resolve(root,path)).isFile()||!readFileSync(resolve(root,path)).equals(blob))failures.push(path)}catch{failures.push(path)}
 }
 if(failures.length)throw Error('SQL_CHECKOUT_BYTES_MISMATCH: '+failures.join(', '));
 console.log(`SQL_CHECKOUT_BYTES_OK ${commit} ${paths.length} files`);
}catch(error){console.error(error.message);process.exitCode=1}
