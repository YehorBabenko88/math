import assert from 'node:assert/strict';
const pin='05f48fc01cecb49cbbf5331168c9a301e5a55825',roleSource='4ba390b8e12070499d54b12e5609c683c00607ee';
const cells=['linux-22-16','linux-22-18','linux-24-16','linux-24-18'];
const oid=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x),digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),id=x=>typeof x==='string'&&/^[1-9][0-9]{0,19}$/.test(x);
export function validateTestedSource(c){
 assert(['push','pull_request','workflow_dispatch'].includes(c.event));for(const k of ['workloadHead','testedHead','tree'])assert(oid(c[k]));assert(id(c.runId)&&id(c.attempt));
 if(c.event==='pull_request'){assert(oid(c.base));assert.notEqual(c.testedHead,c.workloadHead);assert.deepEqual(c.parents,[c.base,c.workloadHead],'Tested PR merge ordered base/head parents');}else assert.equal(c.testedHead,c.workloadHead);return true;
}
/** Runtime caller supplies Root-owned actual ZIP custody result. Synthetic arguments prove consistency only. */
export function combinePlatformCoverage(math,root,c){
 try{
  validateTestedSource(c);assert.equal(math.ok,true);assert.equal(math.scope,'CURRENT_MATH_SIX_AXES_ONLY_NOT_TRANSFERRED_ROOT_COVERAGE');assert.equal(math.cells,6);for(const[k,v]of Object.entries({head:c.testedHead,tree:c.tree,runId:c.runId,attempt:c.attempt}))assert.equal(math[k],v);
  for(const[k,v]of Object.entries({status:'VALIDATED_UNIT_ARTIFACT_CUSTODY',coverage:'ROOT_FOUR_UNIT_CELLS_ONLY',scope:'ROOT_FOUR_DOWNLOADED_UNIT_ARTIFACTS',cells:4,roles_per_cell:34,role_source:roleSource,runner_workflow_source:pin,workload_head:c.workloadHead,run_id:c.runId,attempt:c.attempt,download_custody:'CURRENT_RUN_ZIP_DIGEST_AND_METADATA_BOUND',authority:'NONE',source_authentication:'NOT_EVALUATED',native_acceptance:'NOT_QUALIFIED',production:'NO_GO'}))assert.equal(root[k],v);
  for(const key of ['bindings','archives']){assert(Array.isArray(root[key]));assert.deepEqual(root[key].map(x=>x.cell).sort(),cells);assert.equal(new Set(root[key].map(x=>x.artifact_id)).size,4);}
  assert.equal(new Set(root.bindings.map(x=>x.job_id)).size,4);assert.equal(new Set(root.bindings.map(x=>x.check_run_id)).size,4);
  for(const b of root.bindings){assert(id(b.artifact_id)&&id(b.job_id)&&id(b.check_run_id)&&digest(b.receipt_sha256));const a=root.archives.find(x=>x.cell===b.cell);assert.equal(a.artifact_id,b.artifact_id);assert(digest(a.zip_sha256)&&Number.isSafeInteger(a.zip_bytes)&&a.zip_bytes>0&&a.zip_bytes<=1048576);}
  return{ok:true,status:'VERIFIED_TEN_UNIT_CELLS',scope:'SIX_MATH_PLUS_FOUR_ROOT_UNIT_CELLS_ONLY',releaseStatus:'NO_GO',sourceAuthentication:'NOT_EVALUATED',nativeAcceptance:'NOT_QUALIFIED',mathScopedCoverage:math,transferredRootCoverage:root,testedSource:c};
 }catch{return{ok:false,status:'HELD',releaseStatus:'NO_GO',sourceAuthentication:'NOT_EVALUATED',nativeAcceptance:'NOT_QUALIFIED',mathScopedCoverage:math,transferredRootCoverage:root??null};}
}
