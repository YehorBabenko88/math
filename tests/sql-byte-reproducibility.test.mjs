import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const verifier=fileURLToPath(new URL('../scripts/verify-sql-bytes.mjs',import.meta.url));
function git(root,...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim()}
test('SQL byte policy survives LF/CRLF checkout settings and verifier rejects modified bytes',()=>{
 const root=mkdtempSync(join(tmpdir(),'sql-bytes-'));
 try{
  git(root,'init','-q');git(root,'config','user.email','fixture@example.invalid');git(root,'config','user.name','Fixture');
  mkdirSync(join(root,'sql','book'),{recursive:true});
  writeFileSync(join(root,'.gitattributes'),readFileSync(new URL('../.gitattributes',import.meta.url)));
  writeFileSync(join(root,'sql','001.sql'),'SELECT 1;\n');writeFileSync(join(root,'sql','book','001.sql'),'SELECT 2;\r\n');
  git(root,'add','.');git(root,'commit','-qm','fixture');
  for(const autocrlf of ['false','true']){
   rmSync(join(root,'sql'),{recursive:true});git(root,'-c',`core.autocrlf=${autocrlf}`,'checkout','HEAD','--','sql');
   assert.equal(readFileSync(join(root,'sql','001.sql'),'utf8'),'SELECT 1;\n');
   assert.equal(readFileSync(join(root,'sql','book','001.sql'),'utf8'),'SELECT 2;\r\n');
   execFileSync(process.execPath,[verifier],{cwd:root});
  }
  writeFileSync(join(root,'sql','001.sql'),'SELECT 1;\r\n');
  assert.throws(()=>execFileSync(process.execPath,[verifier],{cwd:root,stdio:'pipe'}),error=>error.status===1&&error.stderr.toString().includes('SQL_CHECKOUT_BYTES_MISMATCH'));
  // Staging altered bytes must not bless them as the committed execution source.
  git(root,'add','sql/001.sql');
  assert.throws(()=>execFileSync(process.execPath,[verifier],{cwd:root,stdio:'pipe'}),error=>error.status===1);
 }finally{rmSync(root,{recursive:true,force:true})}
});
