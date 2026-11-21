import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/adminit-synthetic-containment.yml',import.meta.url),'utf8');
test('native public upload excludes raw report and bootstrap streams',()=>{
 const upload=workflow.slice(workflow.indexOf('- name: Retain redacted metadata only'));
 assert.ok(upload.includes('adminit-build/evidence-sha256.json'));
 assert.doesNotMatch(upload,/adminit-native\//);
 assert.doesNotMatch(upload,/bootstrap-\*\.txt/);
 assert.doesNotMatch(upload,/bootstrap-process\.json/);
});
test('native workflow does not echo raw bootstrap streams',()=>{
 assert.doesNotMatch(workflow,/^\s*Get-Content\s+"\$build\/bootstrap-(stdout|stderr)\.txt"/m);
});
test('public manifest excludes raw paths and self-referential private inventory',()=>{
 assert.match(workflow,/privateInventorySha256=\$inventoryDigest/);
 assert.match(workflow,/rawNativeEvidencePublished=\$false/);
 assert.match(workflow,/\$_.Name -ne 'private-inventory\.json'/);
 const published=workflow.match(/@\{sourceHead='\$\{\{ github\.sha \}\}';runId=.*?Set-Content "\$build\/evidence-sha256\.json"/s)?.[0];
 assert.ok(published);
 assert.doesNotMatch(published,/;files=\$files/);
});
