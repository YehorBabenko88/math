import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {captureSourceIdentity,verifySourceIdentity} from '../scripts/verify-source-identity.mjs';
import {createProvenance} from '../scripts/ci-provenance.mjs';
const project=new URL('../',import.meta.url);
function fixture(run){
 let receipt;
 const previous=process.cwd(),root=mkdtempSync(join(tmpdir(),'math-source-proof-'));
 const git=(...args)=>execFileSync('git',['--no-replace-objects','-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git('init','--quiet');mkdirSync(join(root,'scripts'));
  for(const file of ['package.json','package-lock.json','scripts/book-ingestion-requirements.txt'])writeFileSync(join(root,file),readFileSync(new URL(file,project)));
  writeFileSync(join(root,'application.mjs'),'export const value=1;\n');
  git('-c','core.autocrlf=false','add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','source');process.chdir(root);
  const env={GITHUB_SHA:git('rev-parse','HEAD'),GITHUB_REPOSITORY:'YehorBabenko88/math',GITHUB_WORKFLOW_REF:'YehorBabenko88/math/.github/workflows/ci.yml@refs/heads/example',GITHUB_RUN_ID:'7',GITHUB_RUN_ATTEMPT:'2',PROVENANCE_CONTEXT:'test'};
  receipt=join(tmpdir(),'math-source-before-'+root.split(/[\\/]/).pop()+'.json');env.SOURCE_IDENTITY_RECEIPT=receipt;
  return run({root,git,env});
 }finally{process.chdir(previous);if(receipt)rmSync(receipt,{force:true});rmSync(root,{recursive:true,force:true});}
}
test('F04 changed tracked application cannot qualify committed source',()=>fixture(({env})=>{
 writeFileSync('application.mjs','export const value=2;\n');
 assert.throws(()=>createProvenance(env),/tracked|source|tree/i);
}));
test('F05 absent or malformed GitHub identity cannot qualify',()=>fixture(({env})=>{
 for(const invalid of [{GITHUB_SHA:env.GITHUB_SHA},{...env,GITHUB_REPOSITORY:'other/repository'},{...env,GITHUB_WORKFLOW_REF:'invalid'},{...env,GITHUB_RUN_ID:'not-a-number'},{...env,GITHUB_RUN_ATTEMPT:'0'},{...env,PROVENANCE_CONTEXT:''},{...env,PROVENANCE_CONTEXT:'native-pdf'}])assert.throws(()=>createProvenance(invalid),/metadata|repository|workflow|context|run|attempt/i);
}));

test('F04 pre/post source evidence binds commit tree run and context, with generated outputs excluded',()=>fixture(({env})=>{
 assert.throws(()=>createProvenance(env),/ENOENT|receipt/);
 captureSourceIdentity(env);
 mkdirSync('test-results');writeFileSync('test-results/generated.json','{}');
 const result=createProvenance(env);assert.equal(result.qualified,true);assert.equal(result.testedWorktreeVerified,true);
 assert.equal(result.sourceEvidence,'self-reported-pre-post-tracked-tree/v1');assert.match(result.committedTreeSha,/^[a-f0-9]{40}$/);
 assert.throws(()=>createProvenance({...env,GITHUB_RUN_ATTEMPT:'3'}),/Pre\/post/);
 writeFileSync('application.mjs','export const value=2;\n');assert.throws(()=>createProvenance(env),/Tracked source bytes|Noncanonical tracked source EOL/);
}));
test('F04 stale index and assume-unchanged tracked bytes cannot qualify',()=>fixture(({git,env})=>{
 captureSourceIdentity(env);git('update-index','--assume-unchanged','application.mjs');writeFileSync('application.mjs','changed');
 assert.throws(()=>createProvenance(env),/Tracked source bytes|Noncanonical tracked source EOL/);
 git('update-index','--no-assume-unchanged','application.mjs');git('-c','core.autocrlf=false','add','application.mjs');
 writeFileSync('application.mjs','export const value=1;\n');assert.throws(()=>createProvenance(env),/index/);
}));
test('F04 controlled Windows CRLF conversion retains exact committed tree identity',()=>fixture(({git,env})=>{
 git('config','core.autocrlf','true');writeFileSync('application.mjs','export const value=1;\r\n');
 assert.equal(verifySourceIdentity(env.GITHUB_SHA).sourceSha,env.GITHUB_SHA);
 writeFileSync('application.mjs','export const value=2;\r\n');assert.throws(()=>verifySourceIdentity(env.GITHUB_SHA),/Tracked source bytes|Noncanonical tracked source EOL/);
}));
test('F05 metadata rejects controls huge IDs wrong workflow/context and cross-repository refs',()=>fixture(({env})=>{
 for(const change of [{GITHUB_RUN_ID:'7\n'},{GITHUB_RUN_ATTEMPT:'2\r'},{GITHUB_RUN_ID:'01'},{GITHUB_RUN_ID:'9'.repeat(30)},{GITHUB_RUN_ATTEMPT:'-1'},{GITHUB_REPOSITORY:'YehorBabenko88/math\n'},{GITHUB_WORKFLOW_REF:'other/math/.github/workflows/ci.yml@refs/heads/example'},{GITHUB_WORKFLOW_REF:'YehorBabenko88/math/.github/workflows/ci.yml@refs/heads/../bad'},{GITHUB_WORKFLOW_REF:'YehorBabenko88/math/.github/workflows/missing.yml@refs/heads/example'},{PROVENANCE_CONTEXT:'test\n'}])assert.throws(()=>createProvenance({...env,...change}),/metadata|workflow|context/);
}));

test('F04 corrupt or missing source checkpoints fail closed; receipt stays outside checkout',()=>fixture(({env,root})=>{
 assert.throws(()=>captureSourceIdentity({...env,SOURCE_IDENTITY_RECEIPT:join(root,'..fake-receipt.json')}),/outside checkout/);
 captureSourceIdentity(env);writeFileSync(env.SOURCE_IDENTITY_RECEIPT,'{corrupted');assert.throws(()=>createProvenance(env),/JSON|position|property|Unexpected/);
}));
