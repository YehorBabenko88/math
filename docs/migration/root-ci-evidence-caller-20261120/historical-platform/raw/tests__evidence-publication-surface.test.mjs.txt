import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const observed = ['F03_R06_REMEDIATION_REPORT.md','MATH_ABC_INTEGRATION_AUDIT.md','MATH_F01_F02_INTEGRATION_AUDIT.md','docs/book-full-ci-coverage-audit.md'];
for (const path of observed) test('published report omits observed local account paths: '+path,()=>{
 const text=readFileSync(new URL('../'+path,import.meta.url),'utf8');
 assert.equal(/(?:[a-z]:[\\/]+Users[\\/]+(?!Public(?:[\\/]|$))|\/home\/)/i.test(text),false,'local account path remains');
});
test('publication policy rejects nested and alternate payload fields',async()=>{
 const {inspectPublication}=await import('../scripts/evidence-publication-policy.mjs');
 for(const key of ['content','data','base64']){
  const value=JSON.stringify({files:[{metadata:{[key]:Buffer.from('synthetic diagnostic private payload').toString('base64')}}]});
  assert.ok(inspectPublication('docs/audits/synthetic.json',value).some(x=>x.kind==='payload-field'));
 }
});
test('publication policy covers selected tracked evidence surfaces',async()=>{
 const {checkTrackedPublication}=await import('../scripts/evidence-publication-policy.mjs');
 assert.deepEqual(checkTrackedPublication(),[]);
});
test('reviewed Public fixture path allowed; local account path rejected',async()=>{
 const {inspectPublication}=await import('../scripts/evidence-publication-policy.mjs');
 assert.deepEqual(inspectPublication('docs/windows-q01-lab.md',String.raw`C:\Users\Public\MathUniverseQ01Lab`),[]);
 assert.ok(inspectPublication('docs/audits/sample.md',String.raw`C:\Users\SyntheticAccount\evidence`).length);
});

test('surface inventory includes every selected evidence family',async()=>{
 const {isPublicationSurface}=await import('../scripts/evidence-publication-policy.mjs');
 for(const path of ['ROOT_AUDIT.md','REMEDIATION_REPORT.md','INTEGRATION_ACCEPTANCE.md','docs/audits/nested/evidence.json','docs/book-full-ci-coverage-audit.md'])assert.equal(isPublicationSurface(path),true,path);
 for(const path of ['outputs/private.json','tests/fixtures/synthetic.json','src/module.mjs'])assert.equal(isPublicationSurface(path),false,path);
});
test('policy rejects unreviewed Public paths, host identity and long encoded strings',async()=>{
 const {inspectPublication}=await import('../scripts/evidence-publication-policy.mjs');
 assert.ok(inspectPublication('docs/audits/sample.md',String.raw`C:\Users\Public\unreviewed`).length);
 for(const key of ['machineName','userSid'])assert.ok(inspectPublication('docs/audits/sample.json',JSON.stringify({nested:{[key]:'synthetic'}})).some(x=>x.kind==='host-identity-field'));
 assert.ok(inspectPublication('docs/audits/sample.md',Buffer.from('synthetic '.repeat(40)).toString('base64')).some(x=>x.kind==='long-encoded-candidate'));
});
