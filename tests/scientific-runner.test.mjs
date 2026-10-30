import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
const runner=new URL('../scripts/scientific/run-contracts.mjs',import.meta.url);
function fixture(t,code){
 const dir=mkdtempSync(join(tmpdir(),'math-science-receipt-'));
 t.after(()=>{const rel=relative(resolve(tmpdir()),resolve(dir));if(!rel||rel.startsWith('..')||rel.includes(':'))throw Error('Invalid temporary path');rmSync(dir,{recursive:true,force:true});});
 for(const d of ['src','tests','scripts/scientific'])mkdirSync(join(dir,d),{recursive:true});
 copyFileSync(runner,join(dir,'scripts/scientific/run-contracts.mjs'));writeFileSync(join(dir,'scripts/scientific/test-inventory.json'),JSON.stringify(['tests/fixture.test.mjs']));
 writeFileSync(join(dir,'src/value.mjs'),'export default 1;\n');writeFileSync(join(dir,'tests/fixture.test.mjs'),code);
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:dir,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 git('init');git('add','.');git('-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','-m','synthetic fixture');
 const sha=git('rev-parse','HEAD');return {dir,sha,git,run:expected=>spawnSync(process.execPath,['scripts/scientific/run-contracts.mjs'],{cwd:dir,env:{...process.env,EXPECTED_SOURCE_SHA:expected??sha},encoding:'utf8',windowsHide:true,timeout:10000}),receipt:()=>JSON.parse(readFileSync(join(dir,'outputs/scientific-engine/receipt.json')))};
}
test('qualification fails before execution for wrong exact SHA',t=>{
 const f=fixture(t,"throw Error('must not execute');");const r=f.run('0'.repeat(40));assert.equal(r.status,1);assert.match(r.stderr,/SCIENTIFIC_QUALIFICATION_BLOCKED/);
});
test('qualification receipt requires all tests passed and actual unchanged tree',t=>{
 const f=fixture(t,"import test from 'node:test';test('synthetic',()=>{});");assert.equal(f.run().status,0);const r=f.receipt();assert.equal(r.status,'PASS');assert.equal(r.sourceSHA,f.sha);assert.equal(r.summary.pass,1);assert.equal(r.testedWorktree,'TRACKED_BYTES_UNCHANGED');
});
test('skipped tests never qualify as successful contracts',t=>{
 const f=fixture(t,"import test from 'node:test';test.skip('unavailable',()=>{});");assert.equal(f.run().status,1);assert.equal(f.receipt().status,'FAIL');assert.equal(f.receipt().summary.skipped,1);
});
test('test-time source mutation cannot claim an unchanged tested tree',t=>{
 const f=fixture(t,"import test from 'node:test';import {writeFileSync} from 'node:fs';test('mutation',()=>writeFileSync('src/value.mjs','changed')); ");assert.equal(f.run().status,1);assert.equal(f.receipt().status,'FAIL');assert.equal(f.receipt().testedWorktree,'TRACKED_BYTES_CHANGED');
});
test('assume-unchanged cannot hide source drift from exact committed identity',t=>{
 const f=fixture(t,"import test from 'node:test';test('synthetic',()=>{});");f.git('update-index','--assume-unchanged','src/value.mjs');writeFileSync(join(f.dir,'src/value.mjs'),'export default 2;\n');assert.equal(f.git('status','--porcelain'),'');const r=f.run();assert.equal(r.status,1);assert.match(r.stderr,/SCIENTIFIC_QUALIFICATION_BLOCKED/);
});
