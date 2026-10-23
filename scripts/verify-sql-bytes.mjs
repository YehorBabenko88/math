// Read-only: verify the exact eleven historical SQL files against unreplaceable HEAD.
// Index drift is rejected; checkout or ledger bytes are never repaired.
import {execFileSync} from 'node:child_process';
import {readFileSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
const expected=['001_adapter_snapshots','002_ingestion_jobs','003_ingestion_claim_fencing','004_ingestion_checkpoints','005_ingestion_service_protocol','006_ingestion_lease_clock'].map(x=>`sql/${x}.sql`).concat(['001_book_queue','002_lossless_json','003_cutover_guard','004_cutover_snapshot_fence','005_control_integrity'].map(x=>`sql/book/${x}.sql`)).sort();
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{maxBuffer:16*1024*1024});
function entries(output,index=false){return output.toString('utf8').split('\0').filter(Boolean).map(record=>{const m=record.match(index?/^(\d+) ([0-9a-f]+) (\d)\t(.+)$/:/^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/);if(!m)throw Error('SQL_CHECKOUT_INVALID_GIT_ENTRY');return index?{mode:m[1],oid:m[2],kind:m[3]==='0'?'blob':'unmerged',path:m[4]}:{mode:m[1],kind:m[2],oid:m[3],path:m[4]};}).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);}
function validate(set,label){if(set.length!==expected.length||set.some((e,i)=>e.path!==expected[i]||e.mode!=='100644'||e.kind!=='blob'))throw Error(`SQL_CHECKOUT_${label}_SET_OR_MODE_MISMATCH`);}
try{
 const root=git('rev-parse','--show-toplevel').toString('utf8').trim();process.chdir(root);
 const commit=git('rev-parse','HEAD').toString('ascii').trim();
 const tree=entries(git('ls-tree','-r','-z',commit,'--','sql'));validate(tree,'HEAD');
 const index=entries(git('ls-files','--stage','-z','--','sql'),true);validate(index,'INDEX');
 if(index.some((e,i)=>e.oid!==tree[i].oid))throw Error('SQL_CHECKOUT_INDEX_DRIFT');
 for(const parent of ['sql','sql/book']){const info=lstatSync(resolve(root,parent));if(!info.isDirectory()||info.isSymbolicLink())throw Error('SQL_CHECKOUT_PARENT_MODE_MISMATCH: '+parent);}
 const failures=[];
 for(const entry of tree){
  const blob=git('cat-file','blob',entry.oid);
  try{const file=resolve(root,entry.path);if(!lstatSync(file).isFile()||!readFileSync(file).equals(blob))failures.push(entry.path)}catch{failures.push(entry.path)}
 }
 if(failures.length)throw Error('SQL_CHECKOUT_BYTES_MISMATCH: '+failures.join(', '));
 console.log(`SQL_CHECKOUT_BYTES_OK ${commit} ${tree.length} files`);
}catch(error){console.error(error.message);process.exitCode=1}
