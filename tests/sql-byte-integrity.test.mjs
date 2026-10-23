import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,renameSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const verifier=fileURLToPath(new URL('../scripts/verify-sql-bytes.mjs',import.meta.url));
const paths=['001_adapter_snapshots','002_ingestion_jobs','003_ingestion_claim_fencing','004_ingestion_checkpoints','005_ingestion_service_protocol','006_ingestion_lease_clock'].map(x=>`sql/${x}.sql`).concat(['001_book_queue','002_lossless_json','003_cutover_guard','004_cutover_snapshot_fence','005_control_integrity'].map(x=>`sql/book/${x}.sql`));
function fixture(fn){const root=mkdtempSync(join(tmpdir(),'sql-integrity-'));const git=(...a)=>execFileSync('git',['-C',root,...a],{encoding:'utf8'}).trim();try{git('init','-q');git('config','core.autocrlf','false');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');mkdirSync(join(root,'sql/book'),{recursive:true});for(const p of paths)writeFileSync(join(root,p),'SELECT 1;\n');git('add','.');git('commit','-qm','fixture');fn(root,git);}finally{rmSync(root,{recursive:true,force:true});}}
const run=root=>spawnSync(process.execPath,[verifier],{cwd:root,encoding:'utf8'});
function rejected(root){const r=run(root);assert.equal(r.status,1,r.stdout+r.stderr);}
test('blob replacements cannot bless changed SQL bytes',()=>fixture((root,git)=>{const old=git('rev-parse',`HEAD:${paths[0]}`);writeFileSync(join(root,paths[0]),'SELECT 4242;\n');const replacement=git('hash-object','-w',paths[0]);git('replace',old,replacement);rejected(root);}));
test('tree replacements cannot bless changed SQL bytes',()=>fixture((root,git)=>{const old=git('rev-parse','HEAD^{tree}');writeFileSync(join(root,paths[0]),'SELECT 4242;\n');git('add',paths[0]);const replacement=git('write-tree');git('reset','-q','HEAD','--',paths[0]);git('replace',old,replacement);rejected(root);}));
for(const mode of ['120000','100755','160000'])test(`committed SQL mode ${mode} is rejected`,()=>fixture((root,git)=>{const object=git('rev-parse',mode==='160000'?'HEAD':`HEAD:${paths[0]}`);git('update-index','--cacheinfo',`${mode},${object},${paths[0]}`);git('commit','-qm','mode fixture');rejected(root);}));
for(const change of ['missing','extra','book-gitlink'])test(`exact eleven SQL set rejects ${change}`,()=>fixture((root,git)=>{if(change==='missing')git('rm','-q',paths[0]);else if(change==='extra'){writeFileSync(join(root,'sql/extra.sql'),'SELECT 1;\n');git('add','sql/extra.sql');}else{git('rm','-qr','sql/book');git('update-index','--add','--cacheinfo',`160000,${git('rev-parse','HEAD')},sql/book`);}git('commit','-qm','set fixture');rejected(root);}));
test('staged SQL drift is rejected even after restoring disk bytes',()=>fixture((root,git)=>{writeFileSync(join(root,paths[0]),'SELECT 4242;\n');git('add',paths[0]);writeFileSync(join(root,paths[0]),'SELECT 1;\n');rejected(root);}));

test('tree replacement view is ignored for a clean original checkout',()=>fixture((root,git)=>{const old=git('rev-parse','HEAD^{tree}');writeFileSync(join(root,paths[0]),'SELECT 4242;\n');git('add',paths[0]);const replacement=git('write-tree');git('reset','-q','HEAD','--',paths[0]);writeFileSync(join(root,paths[0]),'SELECT 1;\n');git('replace',old,replacement);const r=run(root);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/11 files/);}));


for(const parent of ['sql','sql/book'])test('checkout rejects linked parent '+parent,()=>fixture((root)=>{const original=join(root,parent);const moved=join(root,'external-'+parent.replace('/','-'));renameSync(original,moved);symlinkSync(moved,original,process.platform==='win32'?'junction':'dir');rejected(root);}));
