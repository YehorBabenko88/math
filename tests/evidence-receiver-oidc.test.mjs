import test from 'node:test';import assert from 'node:assert/strict';import{generateKeyPairSync,sign,createHash}from'node:crypto';
const kp=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...kp.publicKey.export({format:'jwk'}),kid:'fixture',alg:'RS256',use:'sig'};
const now=2000000000,head='a'.repeat(40),tree='b'.repeat(40),nonce='c'.repeat(64);
const policy={repository:'YehorBabenko88/math',repositoryId:'1',ownerId:'2',subject:'repo:YehorBabenko88/math:pull_request',workflowRef:'YehorBabenko88/math/.github/workflows/collector.yml@refs/heads/trusted',workflowSha:'d'.repeat(40),jobName:'independent-collector',event:'pull_request',sourceRelation:'pr-merge'};
const challenge={nonce,audience:'urn:math-universe:evidence:'+nonce,issuedAt:now-10,expiresAt:now+60,runId:'3',attempt:'1',jobId:'4',checkRunId:'5',sourceHead:head,sourceTree:tree,runHead:'e'.repeat(40),baseHead:'f'.repeat(40)};
const claims={iss:'https://token.actions.githubusercontent.com',aud:challenge.audience,sub:policy.subject,iat:now-5,nbf:now-5,exp:now+50,jti:'fixture-token-unique',repository:policy.repository,repository_id:'1',repository_owner_id:'2',workflow_ref:policy.workflowRef,workflow_sha:policy.workflowSha,run_id:'3',run_attempt:'1',check_run_id:'5',sha:head,event_name:'pull_request',runner_environment:'github-hosted'};
const platform={run:{id:3,run_attempt:1,head_sha:challenge.runHead,status:'in_progress',event:'pull_request',pull_requests:[{head:{sha:'e'.repeat(40)},base:{sha:'f'.repeat(40)}}],repository:{full_name:policy.repository,id:1,owner:{id:2}}},job:{id:4,run_id:3,head_sha:challenge.runHead,status:'in_progress',name:policy.jobName,check_run_url:'https://api.github.com/repos/YehorBabenko88/math/check-runs/5'},commit:{sha:head,parents:[{sha:'f'.repeat(40)},{sha:'e'.repeat(40)}],commit:{tree:{sha:tree}}}};
platform.jobs={total_count:1,jobs:[platform.job]};
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');function jwt(c=claims,h={alg:'RS256',kid:'fixture',typ:'JWT'}){const input=encode(h)+'.'+encode(c);return input+'.'+sign('RSA-SHA256',Buffer.from(input),kp.privateKey).toString('base64url');}
test('OIDC binds signed check_run_id to independently fetched job/run/attempt and source tree',async()=>{const {verifyWorkload}=await import('../src/evidence-receiver/oidc.mjs');const r=verifyWorkload(jwt(),{jwks:{keys:[jwk]},policy,challenge,platform,now});assert.equal(r.jobId,'4');assert.equal(r.tokenSha256,createHash('sha256').update(jwt()).digest('hex'));});
for(const [name,change] of [['issuer',{iss:'https://other.invalid'}],['audience',{aud:'wrong'}],['expiry',{exp:now}],['future',{nbf:now+1}],['stale issuance',{iat:now-400}],['repository',{repository:'other/math'}],['owner',{repository_owner_id:'9'}],['workflow',{workflow_sha:'f'.repeat(40)}],['source',{sha:'f'.repeat(40)}],['attempt',{run_attempt:'2'}],['run',{run_id:'8'}],['check run',{check_run_id:'8'}],['missing check run',{check_run_id:undefined}],['runner',{runner_environment:'self-hosted'}],['subject',{sub:'wrong'}]])test('OIDC rejects '+name,async()=>{const {verifyWorkload}=await import('../src/evidence-receiver/oidc.mjs');assert.throws(()=>verifyWorkload(jwt({...claims,...change}),{jwks:{keys:[jwk]},policy,challenge,platform,now}),/BLOCKED/);});
test('OIDC rejects forged signature, duplicate claims, unsafe header and platform substitution',async()=>{const{verifyWorkload}=await import('../src/evidence-receiver/oidc.mjs');const opts={jwks:{keys:[jwk]},policy,challenge,platform,now};const token=jwt();assert.throws(()=>verifyWorkload(token.slice(0,-4)+'AAAA',opts),/BLOCKED/);assert.throws(()=>verifyWorkload(jwt(claims,{alg:'HS256',kid:'fixture',typ:'JWT'}),opts),/BLOCKED/);assert.throws(()=>verifyWorkload(jwt(claims,{alg:'RS256',kid:'fixture',typ:'JWT',jku:'https://evil.invalid'}),opts),/BLOCKED/);const payload=Buffer.from(JSON.stringify(claims).replace('{','{"run_id":"evil",')).toString('base64url'),input=encode({alg:'RS256',kid:'fixture',typ:'JWT'})+'.'+payload;assert.throws(()=>verifyWorkload(input+'.'+sign('RSA-SHA256',Buffer.from(input),kp.privateKey).toString('base64url'),opts),/BLOCKED/);for(const p of [{...platform,job:{...platform.job,check_run_url:platform.job.check_run_url.replace('/5','/99')}},{...platform,run:{...platform.run,run_attempt:2}},{...platform,commit:{...platform.commit,commit:{tree:{sha:'f'.repeat(40)}}}}])assert.throws(()=>verifyWorkload(token,{...opts,platform:p}),/BLOCKED/);});
test('provider adapter uses fixed HTTPS job/attempt paths and suppresses transport errors',async()=>{const {readPlatform,fetchGitHubJson}=await import('../src/evidence-receiver/oidc.mjs');const seen=[];const fetcher=async url=>{seen.push(url);let body=url.includes('/attempts/')?{total_count:1,jobs:[platform.job]}:url.includes('/actions/jobs/')?platform.job:url.includes('/commits/')?platform.commit:platform.run;return new Response(JSON.stringify(body));};const p=await readPlatform(challenge,{fetcher});assert.equal(p.job.id,4);assert.equal(p.jobs.total_count,1);assert.equal(seen.length,4);assert.ok(seen.every(u=>u.startsWith('https://api.github.com/repos/YehorBabenko88/math/')));await assert.rejects(()=>fetchGitHubJson('/repos/YehorBabenko88/math/actions/runs/3',{fetcher:async()=>{throw Error('private-credential-value');}}),e=>/BLOCKED/.test(e.message)&&!e.message.includes('private-credential-value'));});
test('nonce expiry, not full OIDC lifetime, bounds a normally longer-lived GitHub token',async()=>{const{verifyWorkload}=await import('../src/evidence-receiver/oidc.mjs');assert.equal(verifyWorkload(jwt({...claims,exp:now+300}),{jwks:{keys:[jwk]},policy,challenge,platform,now}).expiresAt,challenge.expiresAt);});
test('PR merge proof rejects unrelated commit parents and changed API base',async()=>{const{verifyWorkload}=await import('../src/evidence-receiver/oidc.mjs');for(const p of [{...platform,commit:{...platform.commit,parents:[{sha:'0'.repeat(40)},{sha:'e'.repeat(40)}]}},{...platform,run:{...platform.run,pull_requests:[{head:{sha:'e'.repeat(40)},base:{sha:'0'.repeat(40)}}]}}])assert.throws(()=>verifyWorkload(jwt(),{jwks:{keys:[jwk]},policy,challenge,platform:p,now}),/BLOCKED/);});

test('signed claims cannot bypass missing attempt-specific job inventory',async()=>{const{verifyWorkload}=await import('../src/evidence-receiver/oidc.mjs');assert.throws(()=>verifyWorkload(jwt(),{jwks:{keys:[jwk]},policy,challenge,platform:{...platform,jobs:undefined},now}),/BLOCKED/);});

test('PR merge binds distinct synthetic merge and PR head, rejects second-parent substitution',async()=>{
 const {verifyWorkload}=await import('../src/evidence-receiver/oidc.mjs');
 const options={jwks:{keys:[jwk]},policy,challenge,platform,now};
 assert.equal(verifyWorkload(jwt(),options).sourceHead,challenge.sourceHead);
 assert.notEqual(challenge.sourceHead,challenge.runHead);
 assert.throws(()=>verifyWorkload(jwt(),{...options,platform:{...platform,commit:{...platform.commit,parents:[{sha:challenge.baseHead},{sha:challenge.sourceHead}]}}}),/BLOCKED/);
 assert.throws(()=>verifyWorkload(jwt(),{...options,platform:{...platform,run:{...platform.run,pull_requests:[{head:{sha:'0'.repeat(40)},base:{sha:challenge.baseHead}}]}}}),/BLOCKED/);
});

test('PR merge rejects ambiguous PR inventory, stale run SHA and wrong signed merge SHA',async()=>{
 const {verifyWorkload}=await import('../src/evidence-receiver/oidc.mjs');
 const options={jwks:{keys:[jwk]},policy,challenge,platform,now};
 const mutations=[
  {...platform,run:{...platform.run,pull_requests:[...platform.run.pull_requests,...platform.run.pull_requests]}},
  {...platform,run:{...platform.run,head_sha:'0'.repeat(40)}},
  {...platform,job:{...platform.job,head_sha:'0'.repeat(40)}},
  {...platform,commit:{...platform.commit,sha:'0'.repeat(40)}}
 ];
 for(const p of mutations)assert.throws(()=>verifyWorkload(jwt(),{...options,platform:p}),/BLOCKED/);
 assert.throws(()=>verifyWorkload(jwt({...claims,sha:'e'.repeat(40)}),options),/BLOCKED/);
});
test('PR merge rejects substituted attempt job and check-run inventory',async()=>{
 const {verifyWorkload}=await import('../src/evidence-receiver/oidc.mjs');
 const opts={jwks:{keys:[jwk]},policy,challenge,platform,now};
 for(const jobs of [
  {total_count:2,jobs:[platform.job,platform.job]},
  {total_count:1,jobs:[{...platform.job,id:999}]},
  {total_count:1,jobs:[{...platform.job,check_run_url:'https://api.github.com/repos/YehorBabenko88/math/check-runs/999'}]}
 ])assert.throws(()=>verifyWorkload(jwt(),{...opts,platform:{...platform,jobs}}),/BLOCKED/);
});

test('documented GitHub JOSE thumbprint header retains strict RS256 and selected-JWK binding',async()=>{
 const {verifyWorkload}=await import('../src/evidence-receiver/oidc.mjs');
 const thumb=Buffer.alloc(20,7).toString('base64url');
 const header={alg:'RS256',kid:'fixture',typ:'JWT',x5t:thumb};
 const options={jwks:{keys:[{...jwk,x5t:thumb}]},policy,challenge,platform,now};
 assert.equal(verifyWorkload(jwt(claims,header),options).jobId,'4');
 for(const h of [{...header,x5t:'bad'},{...header,x5t:Buffer.alloc(20,8).toString('base64url')},{...header,jku:'https://invalid.test'},{...header,alg:'none'},{...header,crit:['x5t']}])assert.throws(()=>verifyWorkload(jwt(claims,h),options),/BLOCKED/);
 assert.throws(()=>verifyWorkload(jwt(claims,header),{...options,jwks:{keys:[jwk]}}),/BLOCKED/);
});
