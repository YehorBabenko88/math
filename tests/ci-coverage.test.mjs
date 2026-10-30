import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('mandatory PostgreSQL CI covers the full matrix without selective triggers or file filters',async()=>{
 const sql=await readFile(new URL('../.github/workflows/postgres-integration.yml',import.meta.url),'utf8');
 assert.match(sql,/node: \['22', '24'\]/);assert.match(sql,/postgres: \['16', '18'\]/);
 assert.doesNotMatch(sql,/\b(?:paths|branches):|test-(?:skip|name)-pattern|\*-live\.test|continue-on-error/);
 assert.match(sql,/node scripts\/run-platform-qualification\.mjs postgres/);assert.match(sql,/BOOK_INGESTION_PYTHON: python/);
 const wrapper=await readFile(new URL('../scripts/run-platform-qualification.mjs',import.meta.url),'utf8');
 assert.match(wrapper,/scripts\/test-full-ci\.mjs/);
 assert.match(sql,/needs: \[postgres-integration, windows-platform\]/);
 assert.match(sql,/node scripts\/ci-platform-coverage\.mjs \.ci-downloaded/);
 assert.match(sql,/persist-credentials: false/);assert.match(sql,/fail-fast: false/);
 assert.match(sql,/Full CI coverage/);assert.match(sql,/if: always\(\)/);
});
test('PDF and browser remain unconditional, bounded, read-only checks without test retries',async()=>{
 for(const file of ['book-ingestion.yml','browser.yml','ci.yml']){
  const sql=await readFile(new URL('../.github/workflows/'+file,import.meta.url),'utf8');
  assert.doesNotMatch(sql,/\b(?:paths|branches):|pull_request_target|secrets\.|write-all|continue-on-error/);
  assert.match(sql,/timeout-minutes:/);assert.match(sql,/contents: read/);assert.match(sql,/persist-credentials: false/);
 }
 const browser=await readFile(new URL('../playwright.config.mjs',import.meta.url),'utf8');assert.match(browser,/retries:\s*0/);
});
test('strict runner rejects skipped, todo, failed and empty child suites, accepts complete suites',async()=>{
 const {runStrictTests}=await import('../scripts/test-full-ci.mjs');
 const directory=await mkdtemp(join(tmpdir(),'math-ci-contract-'));
 try{
  for(const [name,body,ok] of [
   ['pass',"test('works',()=>{});",true],
   ['skip',"test('missing',{skip:true},()=>{});",false],
   ['todo',"test('pending',{todo:true},()=>{});",false],
   ['fail',"test('broken',()=>{throw Error('regression')});",false],
   ['empty','',false],
  ]){
   const path=join(directory,name+'.test.mjs');await writeFile(path,"import test from 'node:test';\n"+body);
   const result=await runStrictTests({files:[path],quiet:true});assert.equal(result.ok,ok,name);
   assert.equal(result.summary!==null,true,name+' has final TAP summary');
  }
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('full CI refuses missing dependencies, inherited test selectors and non-test database targets',async()=>{
 const {runStrictTests,validateFullCiEnvironment}=await import('../scripts/test-full-ci.mjs');
 const env={BOOK_INGESTION_PYTHON:'python',MATH_UNIVERSE_TEST_DATABASE_URL:'postgres://math_test@127.0.0.1/math_universe_test'};
 assert.doesNotThrow(()=>validateFullCiEnvironment(env));
 for(const invalid of [{...env,BOOK_INGESTION_PYTHON:''},{...env,MATH_UNIVERSE_TEST_DATABASE_URL:''},{...env,MATH_UNIVERSE_TEST_DATABASE_URL:'postgres://operator@db.example/production'}])assert.throws(()=>validateFullCiEnvironment(invalid));
 for(const selector of ['--test-skip-pattern=x','--test-name-pattern=x','--test-only'])await assert.rejects(runStrictTests({files:['unused.test.mjs'],env:{NODE_OPTIONS:selector},quiet:true}),/filters/);
 await assert.rejects(runStrictTests({files:[]}),/inventory/);
});
