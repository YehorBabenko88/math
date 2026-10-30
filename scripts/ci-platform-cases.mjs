import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {relative,resolve,join} from 'node:path';
import {loadPolicy,caseId,sha} from './ci-platform-coverage.mjs';
const policy=loadPolicy(),digest=sha(JSON.stringify(policy));

export function platformTests(url,nodeTest){
 const file=relative(resolve('.'),fileURLToPath(url)).replaceAll('\\','/');
 return (name,options,fn)=>{
  if(typeof options==='function'){fn=options;options={};}
  const c=policy.cases.find(c=>c.file===file&&c.name===name);
  if(!c)return nodeTest(name,options,fn);
  const profile=process.env.MATH_CI_PLATFORM_PROFILE;
  if(!profile)return nodeTest(name,options,fn);
  assert.equal(profile,process.platform==='linux'?'linux-pg':process.platform==='win32'?'windows-native':'UNSUPPORTED');
  assert.equal(process.env.GITHUB_ACTIONS,'true','strict platform qualification requires hosted CI');
  const dir=process.env.MATH_CI_CASE_RECORDS;assert.ok(dir&&resolve(dir)===dir);
  const applicable=c.platform==='all'||c.platform===process.platform;
  const title=applicable?name:name+' [routing contract; native NOT_RUN on '+process.platform+']';
  return nodeTest(title,{...options,skip:false},async t=>{
   if(applicable)await fn(t);
   else {assert.ok(['linux','win32'].includes(c.platform));assert.notEqual(c.platform,process.platform);}
   // Record only after callback completion; the strict root TAP must also be all-PASS.
   const r={id:caseId(c),disposition:applicable?'EXECUTED':'NOT_RUN',platform:process.platform,policyDigest:digest};
   writeFileSync(join(dir,sha(caseId(c))+'.json'),JSON.stringify(r),{flag:'wx'});
  });
 };
}
