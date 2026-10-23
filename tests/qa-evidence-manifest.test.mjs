import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,symlinkSync,linkSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildManifest,verifyManifest} from '../scripts/qa-evidence-manifest.mjs';
const context={sourceSha:'a'.repeat(40),runId:123,runAttempt:2,jobId:'q01-node22'};
test('QA evidence SHA256 detects payload tampering and metadata substitution',t=>{
 const root=mkdtempSync(join(tmpdir(),'math-qa-manifest-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 writeFileSync(join(root,'junit.xml'),'<testsuites tests="1"/>');
 const m=buildManifest({root,files:['junit.xml'],...context});
 assert.throws(()=>verifyManifest(m,root),/trusted run context required/);
 assert.equal(verifyManifest(m,root,context),true);
 assert.throws(()=>verifyManifest(m,root,{...context,runId:999}),/untrusted run context/);
 assert.throws(()=>verifyManifest(m,root,{...context,sourceSha:'b'.repeat(40)}),/untrusted run context/);
 assert.throws(()=>verifyManifest({...m,extra:'injected'},root,context),/unexpected manifest fields/);
 assert.throws(()=>verifyManifest({...m,entries:[{...m.entries[0],extra:'injected'}]},root,context),/invalid evidence entries/);
 assert.throws(()=>verifyManifest({...m,entries:[null]},root,context),/invalid evidence entries/);
 assert.throws(()=>verifyManifest({...m,entries:[...Array(65).fill(m.entries[0])]},root,context),/invalid evidence entries/);
 assert.throws(()=>verifyManifest({...m,runAttempt:3},root,context),/rejected/);
 assert.throws(()=>verifyManifest({...m,entries:[{...m.entries[0],sha256:'0'.repeat(64)}]},root,context),/rejected/);
 writeFileSync(join(root,'junit.xml'),'<testsuites tests="0"/>');
 assert.throws(()=>verifyManifest(m,root,context),/rejected/);
});
test('QA evidence rejects traversal and duplicate inventory',t=>{
 const root=mkdtempSync(join(tmpdir(),'math-qa-manifest-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 writeFileSync(join(root,'evidence.xml'),'ok');
 assert.throws(()=>buildManifest({root,files:['../outside'],...context}),/rejected/);
 assert.throws(()=>buildManifest({root,files:['evidence.xml','evidence.xml'],...context}),/rejected/);
 assert.throws(()=>buildManifest({root,files:['evidence.xml'],...context,sourceSha:'invalid'}),/rejected/);
});

test('QA evidence rejects symbolic and multiply-linked evidence',t=>{
 const root=mkdtempSync(join(tmpdir(),'math-qa-manifest-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 writeFileSync(join(root,'original.xml'),'ok');
 linkSync(join(root,'original.xml'),join(root,'hardlink.xml'));
 assert.throws(()=>buildManifest({root,files:['original.xml'],...context}),/unsafe evidence file/);
 assert.throws(()=>buildManifest({root,files:['hardlink.xml'],...context}),/unsafe evidence file/);
 symlinkSync(join(root,'original.xml'),join(root,'symlink.xml'));
 assert.throws(()=>buildManifest({root,files:['symlink.xml'],...context}),/unsafe evidence file/);
});

test('QA evidence rejects linked parent directory and alias paths',t=>{
 const root=mkdtempSync(join(tmpdir(),'math-qa-parent-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 mkdirSync(join(root,'real'));
 writeFileSync(join(root,'real','junit.xml'),'ok');
 symlinkSync(join(root,'real'),join(root,'alias'),'dir');
 assert.throws(()=>buildManifest({root,files:['alias/junit.xml'],...context}),/symlinked evidence parent/);
 assert.throws(()=>buildManifest({root,files:['real/../real/junit.xml'],...context}),/unsafe path/);
 assert.throws(()=>buildManifest({root,files:['real/./junit.xml'],...context}),/ambiguous evidence path/);
 assert.throws(()=>buildManifest({root,files:['real\\\\junit.xml'],...context}),/ambiguous evidence path/);
});
