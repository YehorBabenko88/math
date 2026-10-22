import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildManifest,verifyManifest} from '../scripts/qa-evidence-manifest.mjs';
const context={sourceSha:'a'.repeat(40),runId:123,runAttempt:2,jobId:'q01-node22'};
test('QA evidence SHA256 detects payload tampering and metadata substitution',t=>{
 const root=mkdtempSync(join(tmpdir(),'math-qa-manifest-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 writeFileSync(join(root,'junit.xml'),'<testsuites tests="1"/>');
 const m=buildManifest({root,files:['junit.xml'],...context});
 assert.equal(verifyManifest(m,root),true);
 assert.throws(()=>verifyManifest({...m,runAttempt:3},root),/rejected/);
 assert.throws(()=>verifyManifest({...m,entries:[{...m.entries[0],sha256:'0'.repeat(64)}]},root),/rejected/);
 writeFileSync(join(root,'junit.xml'),'<testsuites tests="0"/>');
 assert.throws(()=>verifyManifest(m,root),/rejected/);
});
test('QA evidence rejects traversal and duplicate inventory',t=>{
 const root=mkdtempSync(join(tmpdir(),'math-qa-manifest-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 writeFileSync(join(root,'evidence.xml'),'ok');
 assert.throws(()=>buildManifest({root,files:['../outside'],...context}),/rejected/);
 assert.throws(()=>buildManifest({root,files:['evidence.xml','evidence.xml'],...context}),/rejected/);
 assert.throws(()=>buildManifest({root,files:['evidence.xml'],...context,sourceSha:'invalid'}),/rejected/);
});
