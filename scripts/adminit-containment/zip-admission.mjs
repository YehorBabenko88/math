// Independent metadata-only ZIP admission policy. Does not extract or execute.
const hex=/^[a-f0-9]{64}$/;
const oid=/^[a-f0-9]{40}$/;
const id=/^[1-9][0-9]{0,19}$/;
const matches=(pattern,value)=>typeof value==='string'&&pattern.test(value);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype&&Reflect.ownKeys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export function validateZipAdmission(a){
 const keys=['repository','head','tree','runId','attempt','jobId','artifactId','zipSha256','manifestSha256','approved'];
 if(!exact(a,keys))throw Error('ZIP_ADMISSION_INVALID');
 if(a.repository!=='YehorBabenko88/math'||!matches(oid,a.head)||!matches(oid,a.tree)||!matches(id,a.runId)||!matches(id,a.jobId)||!matches(id,a.artifactId)||!Number.isSafeInteger(a.attempt)||a.attempt<1||!matches(hex,a.zipSha256)||!matches(hex,a.manifestSha256)||a.approved!==false)throw Error('ZIP_ADMISSION_INVALID');
 return Object.freeze({head:a.head,tree:a.tree,runId:a.runId,attempt:a.attempt,jobId:a.jobId,artifactId:a.artifactId,trust:'UNATTESTED_METADATA',extraction:'DENIED',execution:'DENIED'});
}
