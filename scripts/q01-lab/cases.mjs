import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const timer=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(time){const remaining=time-performance.now();if(remaining>0)await timer(remaining);}
async function success(ctx,role,options={}){const r=await ctx.one(role,options);ctx.check(r.ok,role+'-succeeded');return r;}
async function valid(ctx,count){
 const r=await success(ctx,'inspect');ctx.check(JSON.stringify(r.integrity)==='["ok"]','sqlite-integrity-ok');
 ctx.check(r.metadata.length===1&&r.metadata[0].singleton===1&&r.metadata[0].version===1&&r.metadata[0].maxAttempts===3,'exact-metadata');
 ctx.check(r.tables.includes('jobs')&&r.tables.includes('queue_metadata')&&r.columns.length===17,'expected-schema');
 ctx.check(r.count===count,'exact-job-count');return r;
}
async function rejected(ctx,options={}){const r=await ctx.one('open',options);ctx.check(!r.ok&&['Invalid queue state','Invalid queue directory'].includes(r.error),'queue-rejected');return r;}
async function pairs(ctx,count,diagnostic=false){
 let failures=0;
 for(let i=0;i<count;i++){
  const directory=ctx.freshDirectory('pair-'+i),options={directory,...(diagnostic?{hook:diagnostic==='passive'?{passive:true}:{}}:{})},a=ctx.child('pair',options),b=ctx.child('pair',options);
  await Promise.all([a.ready(),b.ready()]);ctx.check(a.pid!==b.pid,'distinct-pids-'+i);ctx.observe('pair-start',{iteration:i,firstWorker:a.id,secondWorker:b.id});a.start();b.start();
  const [x,y]=await Promise.all([a.result(),b.result()]);
  if(!x.ok||!y.ok)failures++;
  ctx.observe('native-pair',{iteration:i,success:x.ok&&y.ok,lane:diagnostic==='passive'?'passive-error-only':diagnostic?'diagnostic-preload':'native'});
  ctx.assertions.push({name:'both-openers-'+i,pass:x.ok&&y.ok});
  if(x.ok&&y.ok){ctx.check(x.id===y.id,'dedup-'+i);ctx.check(Number(x.acquired)+Number(y.acquired)===1,'one-lease-'+i);}
  const snapshot=await ctx.one('open',{directory});
  ctx.assertions.push({name:'post-pair-valid-'+i,pass:snapshot.ok&&snapshot.snapshot.jobs.length===1});
  ctx.assertions.push({name:'post-pair-integrity-'+i,pass:(await ctx.one('inspect',{directory})).integrity?.join()==='ok'});
 }
 ctx.check(failures===0,'all-native-pairs-succeeded');
}
async function initialization(ctx,hold){
 const creator=ctx.child('open',{hook:{barrier:'constructor-after'}});await creator.ready();creator.start();await creator.barrier('constructor-after');
 const follower=ctx.child('open',{hook:{}});await follower.ready();follower.start();
 await follower.phase('before-begin');await follower.phase('after-begin');const deadline=performance.now()+hold;
 ctx.check(creator.pending&&follower.pending,'both-workers-live-at-initialization-barrier');
 await until(deadline);ctx.observe('hold-elapsed',{milliseconds:hold});creator.release('constructor-after');
 const [a,b]=await Promise.all([creator.result(),follower.result()]);ctx.check(a.ok,'creator-committed');
 ctx.check(hold<5000?b.ok:!b.ok&&b.error==='Invalid queue state','initialization-deadline-contract');
 await success(ctx,'open');await valid(ctx,0);
}
async function contention(ctx,hold){
 await success(ctx,'open');const holder=ctx.child('hold');await holder.ready();holder.start();await holder.barrier('native-lock-held');
 const follower=ctx.child('open',{hook:{}});await follower.ready();follower.start();await follower.phase('before-begin');
 const start=performance.now();ctx.check(holder.pending&&follower.pending,'writer-held-when-open-attempted');
 await until(start+hold);holder.release('native-lock-held');
 const [a,b]=await Promise.all([holder.result(),follower.result()]);ctx.check(a.ok,'holder-committed');
 ctx.check(hold<5000?b.ok:!b.ok&&b.error==='Invalid queue state','busy-timeout-contract');
 await success(ctx,'open');await valid(ctx,0);
}
async function crash(ctx,phase,{initial=false,lease=false}={}){
 const before=initial?null:(await success(ctx,'seed',{count:3,...(lease?{now:100}:{})})).snapshot;
 const victim=ctx.child(lease?'lease':initial?'open':'enqueue',{page:99,now:lease?100:undefined,hook:{barrier:phase}});await victim.ready();victim.start();await victim.barrier(phase);await victim.kill();
 if(initial){
  const file=join(ctx.directory,'queue.sqlite');ctx.check(existsSync(file),'orphan-preserved');const bytes=digest([...readFileSync(file)]);await rejected(ctx);ctx.check(digest([...readFileSync(file)])===bytes,'orphan-not-repaired');return;
 }
 if(lease){
  const current=(await success(ctx,'open',{now:105})).snapshot,j=current.jobs.find(j=>j.state==='leased');ctx.check(j?.checkpoint?.stage==='checkpoint','checkpoint-durable-after-worker-death');
  const r=await success(ctx,'reissue',{now:111,jobId:j.id,oldToken:j.token});ctx.check(r.rotated&&r.rejected===4&&r.unchanged,'stale-lease-fenced-after-crash');return;
 }
 const after=(await success(ctx,'open')).snapshot;
 if(phase==='after-commit-2'){
  ctx.check(after.jobs.length===4,'committed-unacknowledged-write-preserved');const duplicate=await success(ctx,'enqueue',{page:99});ctx.check(duplicate.snapshot.jobs.length===4,'ambiguous-write-idempotent');await valid(ctx,4);
 }else{ctx.check(digest(after)===digest(before),'whole-snapshot-rollback');await valid(ctx,3);}
}
export async function executeCase(ctx,id){
 if(id.startsWith('concurrent-first-open-'))return pairs(ctx,Number(id.split('-').at(-1)));
 if(id==='passive-first-open-3000')return pairs(ctx,3000,'passive');
 if(id.startsWith('diagnostic-first-open-'))return pairs(ctx,Number(id.split('-').at(-1)),true);
 if(id==='stale-exists-false'){
  const stale=ctx.child('open',{hook:{barrier:'existence-missing-stat'}});await stale.ready();stale.start();await stale.barrier('existence-missing-stat');
  const first=await success(ctx,'seed',{count:1});stale.release('existence-missing-stat');const result=await stale.result();ctx.check(result.ok&&digest(result.snapshot)===digest(first.snapshot),'stale-exists-does-not-reset');return valid(ctx,1);
 }
 if(id==='schema-metadata'){await success(ctx,'open');await success(ctx,'open');return valid(ctx,0);}
 if(id==='atomic-claims'){
  await success(ctx,'seed',{count:20});const children=Array.from({length:4},()=>ctx.child('claims'));await Promise.all(children.map(c=>c.ready()));children.forEach(c=>c.start());const results=await Promise.all(children.map(c=>c.result()));
  ctx.check(results.every(r=>r.ok),'claim-workers-succeeded');const ids=results.flatMap(r=>r.ids);ctx.check(ids.length===20&&new Set(ids).size===20,'exactly-once-successful-claims');
  const snapshot=(await success(ctx,'open')).snapshot;ctx.check(snapshot.jobs.every(j=>j.state==='completed'&&j.checkpoint.stage==='claimed'),'completed-checkpoints-preserved');return valid(ctx,20);
 }
 if(id==='lease-checkpoint'){
  const first=await success(ctx,'lease',{now:100}),r=await success(ctx,'reissue',{now:110,jobId:first.jobId,oldToken:first.token});ctx.check(r.rejected===4&&r.rotated&&r.unchanged&&r.attempts===2,'exact-expiry-and-stale-tokens');ctx.check(r.checkpoint.stage==='checkpoint','checkpoint-preserved');return valid(ctx,1);
 }
 if(id==='unicode-roundtrip'){const r=await success(ctx,'unicode');ctx.check(r.equal&&r.sourceEqual,'lossless-unicode-roundtrip');return valid(ctx,1);}
 if(id==='idempotence'){const r=await success(ctx,'idempotence');ctx.check(r.same&&r.original&&r.count===1,'idempotent-enqueue');return valid(ctx,1);}
 if(id==='existing-empty'){writeFileSync(join(ctx.directory,'queue.sqlite'),Buffer.alloc(0));await rejected(ctx);ctx.check(readFileSync(join(ctx.directory,'queue.sqlite')).length===0,'empty-orphan-not-initialized');return;}
 if(id==='initialization-1s')return initialization(ctx,1000);
 if(id==='initialization-timeout-6.5s'||id==='restart-after-timeout')return initialization(ctx,6500);
 if(id==='lock-4.5s')return contention(ctx,4500);
 if(id==='lock-timeout-5.5s')return contention(ctx,5500);
 if(id==='pause-before-commit'){
  await success(ctx,'open');const writer=ctx.child('enqueue',{hook:{barrier:'before-commit-2'}});await writer.ready();writer.start();await writer.barrier('before-commit-2');
  const before=await success(ctx,'inspect');ctx.check(before.count===0,'uncommitted-job-invisible');writer.release('before-commit-2');ctx.check((await writer.result()).ok,'released-writer-completed');return valid(ctx,1);
 }
 if(id==='crash-before-commit')return crash(ctx,'before-commit-2');
 if(id==='crash-after-commit')return crash(ctx,'after-commit-2');
 if(id==='crash-after-delete')return crash(ctx,'after-delete');
 if(id==='crash-after-insert')return crash(ctx,'after-insert');
 if(id==='crash-initialization')return crash(ctx,'before-commit-1',{initial:true});
 if(id==='crash-checkpoint-resume')return crash(ctx,'after-commit-4',{lease:true});
 if(id==='rollback-write-error'){
  const before=(await success(ctx,'seed',{count:3})).snapshot;const r=await ctx.one('enqueue',{page:99,hook:{fault:'write-insert'}});ctx.check(!r.ok,'injected-write-failed');ctx.check(digest((await success(ctx,'open')).snapshot)===digest(before),'write-error-rolled-back');return valid(ctx,3);
 }
 if(id==='read-error'){
  const before=(await success(ctx,'seed',{count:1})).snapshot;await rejected(ctx,{hook:{fault:'sql-read'}});ctx.check(digest((await success(ctx,'open')).snapshot)===digest(before),'sql-read-error-snapshot-unchanged');return valid(ctx,1);
 }
 const corruptions={'malformed-schema':'schema','wrong-metadata-version':'version','missing-metadata':'metadata','corrupt-payload':'payload','incorrect-types':'types'};
 if(Object.hasOwn(corruptions,id)){
  await success(ctx,'seed',{count:1});await success(ctx,'corrupt',{corruption:corruptions[id]});const file=join(ctx.directory,'queue.sqlite'),before=digest([...readFileSync(file)]);await rejected(ctx);ctx.check(digest([...readFileSync(file)])===before,'corruption-not-repaired');return;
 }
 if(id==='multiwriter'){
  await success(ctx,'open');const workers=Array.from({length:4},(_,i)=>ctx.child('multiwriter',{first:i*10+1,count:10}));await Promise.all(workers.map(c=>c.ready()));workers.forEach(c=>c.start());ctx.check((await Promise.all(workers.map(c=>c.result()))).every(r=>r.ok),'all-writers-committed');return valid(ctx,40);
 }
 throw Error('LAB_UNKNOWN_CASE');
}
