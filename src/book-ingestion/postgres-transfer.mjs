import {validateBookSnapshot,reviewReceipt} from './queue-contract.mjs';
import {sha256} from './json.mjs';
import {hashCandidate} from './candidate.mjs';
import {transactionBookSnapshot} from './postgres-queue.mjs';
import {bookPostgresJSONCompatible,BOOK_POSTGRES_BLOCKERS} from './postgres-json.mjs';
// Only detached, fully checked queue JSON reaches this canonical encoder.
// Use the shared queue bounds rather than imposing the generic helper's limits.
const canonical=v=>JSON.stringify(sort(v));
function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;}
const digest=v=>sha256(canonical(v));
const hashOk=h=>typeof h==='string'&&/^[a-f0-9]{64}$/.test(h);
function checked(input,maxAttempts){
 const s=validateBookSnapshot(input,maxAttempts);
 for(const j of s.jobs){
  const b=j.payload.book;
  if(b!==undefined&&(!b||b.hash!==j.sourceHash||b.edition!==j.edition||typeof b.version!=='string'||!b.version.trim()||typeof b.license!=='string'||!b.license.trim()||!Number.isSafeInteger(b.pageCount)||b.pageCount<j.page||!b.scope||b.scope.allowLocalProcessing!==true||!Array.isArray(b.scope.pages)||!b.scope.pages.includes(j.page)))throw Error('Invalid source provenance');
  if(j.result?.candidate!==undefined){const c=j.result.candidate;if(hashCandidate(c)!==j.result.digest||c.source.hash64hex!==j.sourceHash||c.source.edition!==j.edition||c.locator.pdfPage1based!==j.page||c.extraction.version!==j.extractionVersion||b&&(c.source.version!==b.version||c.source.license!==b.license))throw Error('Invalid candidate provenance');}
  if(j.result?.reviewReceipt!==undefined){const r=reviewReceipt(j.result.reviewReceipt);if(r.candidateDigest!==j.result.digest||j.metrics.reviewDecisions!==1)throw Error('Invalid review digest pin');}
 }
 return s;
}
function normalized(s){const n=structuredClone(s);for(const j of n.jobs)if(j.state==='leased'){delete j.token;delete j.workerId;delete j.leaseUntil;j.state=j.attempts>=n.maxAttempts?'failed':'queued';j.errorCode='RESTORED_LEASE';}return n;}
export function planBookTransfer({snapshot,expectedHash,targetSnapshot,maxAttempts=3}={}){
 const s=checked(snapshot,maxAttempts),snapshotHash=digest(s);if(expectedHash!==undefined&&(!hashOk(expectedHash)||expectedHash!==snapshotHash))throw Error('Snapshot hash mismatch');
 const n=normalized(s),target=targetSnapshot===undefined?{schemaVersion:1,maxAttempts,jobs:[]}:checked(targetSnapshot,maxAttempts),ids=new Map(target.jobs.map(j=>[j.id,j]));
 const insertedIds=[],skippedIds=[],conflictIds=[];
 for(const j of n.jobs){const old=ids.get(j.id);if(!old)insertedIds.push(j.id);else if(digest(old)===digest(j))skippedIds.push(j.id);else conflictIds.push(j.id);}
 const unsupportedIds=n.jobs.filter(j=>!bookPostgresJSONCompatible(j)).map(j=>j.id);
 return {snapshotHash,targetHash:digest(n),insertedIds,skippedIds,conflictIds,unsupportedIds,blockers:[...BOOK_POSTGRES_BLOCKERS],invalidatedLeaseCount:s.jobs.filter(j=>j.state==='leased').length};
}
async function receipt(client,hash){return (await client.query('SELECT snapshot_hash,target_hash,manifest FROM mu_book_imports WHERE snapshot_hash=$1',[hash])).rows[0]??null;}
function sameHead(d,m){return digest(d)===m.targetHeadHash;}
export async function applyBookTransfer({pool,snapshot,expectedHash,maxAttempts=3,now}={}){
 if(!hashOk(expectedHash))throw Error('Expected snapshot hash required');const plan=planBookTransfer({snapshot,expectedHash,maxAttempts}),n=normalized(checked(snapshot,maxAttempts));
 if(plan.unsupportedIds.length)throw Error('Book PostgreSQL lossless JSON storage required');
 return transactionBookSnapshot(pool,{maxAttempts,now},async(d,time,client)=>{
  const old=await receipt(client,plan.snapshotHash);if(old&&!old.manifest.rolledBack){if(old.target_hash!==plan.targetHash)throw Error('Transfer receipt unavailable');return {...old.manifest.report,repeated:true};}
  const p=planBookTransfer({snapshot,expectedHash,targetSnapshot:d,maxAttempts});if(p.conflictIds.length)throw Error('Transfer identity conflict');
  const inserted=new Set(p.insertedIds);d.jobs.push(...n.jobs.filter(j=>inserted.has(j.id)));
  const manifest={version:1,report:p,inserted:p.insertedIds.map(id=>({id,hash:digest(d.jobs.find(j=>j.id===id))})),targetHeadHash:digest(d),activated:false,rolledBack:false};
  await client.query(`INSERT INTO mu_book_imports(snapshot_hash,target_hash,manifest) VALUES($1,$2,$3::jsonb)
   ON CONFLICT(snapshot_hash) DO UPDATE SET target_hash=EXCLUDED.target_hash,manifest=EXCLUDED.manifest
   WHERE mu_book_imports.manifest->>'rolledBack'='true'`,[p.snapshotHash,p.targetHash,JSON.stringify(manifest)]);return {...p,repeated:false};
 });
}
export async function verifyBookTransfer({pool,snapshotHash,maxAttempts=3,now}={}){
 if(!hashOk(snapshotHash))throw Error('Snapshot hash required');
 return transactionBookSnapshot(pool,{maxAttempts,now},async(d,time,client)=>{
  checked(d,maxAttempts);const r=await receipt(client,snapshotHash);if(!r||r.manifest.rolledBack)return {verified:false,snapshotHash};const m=r.manifest;
  const current=new Map(d.jobs.map(j=>[j.id,j]));const records=[...m.report.insertedIds,...m.report.skippedIds];
  // Require the complete recorded target head: any later queue work invalidates pre-cutover evidence.
  const verified=sameHead(d,m)&&records.every(id=>current.has(id))&&m.inserted.every(x=>current.has(x.id)&&digest(current.get(x.id))===x.hash);
  return {verified,snapshotHash,targetHash:r.target_hash,targetHeadHash:digest(d),activated:m.activated,blockers:[...BOOK_POSTGRES_BLOCKERS],contracts:{identity:verified,provenance:verified,review:verified,snapshots:verified,fencing:verified,nativeJsonParity:BOOK_POSTGRES_BLOCKERS.length===0}};
 });
}
export async function rollbackBookTransfer({pool,snapshotHash,maxAttempts=3,now}={}){
 if(!hashOk(snapshotHash))throw Error('Snapshot hash required');
 return transactionBookSnapshot(pool,{maxAttempts,now},async(d,time,client)=>{
  const r=await receipt(client,snapshotHash);if(!r)throw Error('Transfer receipt missing');const m=r.manifest;if(m.activated)throw Error('Transfer already activated');if(m.rolledBack)return {snapshotHash,removedCount:0,repeated:true};
  const byId=new Map(d.jobs.map(j=>[j.id,j]));if(!m.inserted.every(x=>byId.has(x.id)&&digest(byId.get(x.id))===x.hash))throw Error('Imported rows changed');
  const ids=new Set(m.inserted.map(x=>x.id));d.jobs=d.jobs.filter(j=>!ids.has(j.id));m.rolledBack=true;await client.query('UPDATE mu_book_imports SET manifest=$2::jsonb WHERE snapshot_hash=$1',[snapshotHash,JSON.stringify(m)]);return {snapshotHash,removedCount:ids.size,repeated:false};
 });
}

// Called only after an authenticated operator supplies the exact current evidence.
export async function activateBookTransfer({pool,snapshotHash,operatorConfirmation,maxAttempts=3,now}={}){
 if(BOOK_POSTGRES_BLOCKERS.length)return false;
 if(!hashOk(snapshotHash))return false;
 return transactionBookSnapshot(pool,{maxAttempts,now},async(d,time,client)=>{
  checked(d,maxAttempts);const r=await receipt(client,snapshotHash);if(!r||r.manifest.rolledBack||!sameHead(d,r.manifest))return false;
  if(operatorConfirmation!==`SOURCE SQLITE QUIESCED; ACTIVATE BOOK POSTGRES ${snapshotHash} ${r.target_hash} ${digest(d)}`)return false;
  r.manifest.activated=true;await client.query('UPDATE mu_book_imports SET manifest=$2::jsonb WHERE snapshot_hash=$1',[snapshotHash,JSON.stringify(r.manifest)]);return true;
 });
}




