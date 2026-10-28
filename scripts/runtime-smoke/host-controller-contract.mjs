// Contract validation and reference reservation only. There is no live launcher.
import {createPublicKey,createHash,verify} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=x=>{if(!x)throw Error('HOST_CONTRACT_BLOCKED');};
const hex=(s,n)=>typeof s==='string'&&new RegExp('^[0-9a-f]{'+n+'}$').test(s);
const exact=(r,keys)=>need(r!==null&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).sort().join('|')===[...keys].sort().join('|'));
export const COVERAGE=Object.freeze(['ipv4','ipv6','virtualNics','virtualSwitches','hostRoutes','hostLoopback','guestLoopback','sharedFolders','clipboard','guestIntegration','virtualSocketsAndPipes','hostStorage','cloudMetadata','productionCredentials']);
export const JOB=Object.freeze({assignment:'BEFORE_RESUME',killOnClose:true,breakaway:false,maxActiveProcesses:1,memoryMiB:256,cpuMs:1000,wallMs:2000,stdoutMaxBytes:128,stderrMaxBytes:0,watchdog:'INDEPENDENT_HOST',handleReaping:'RETAINED_HANDLES'});
const marker='MATH_UNIVERSE_PROCESS_ONLY_V1\n';
const report=(status,stage,scope='CONTRACT_ONLY')=>({status,stage,scope,physicalRuntime:'NOT_RUN',avState:'NOT_OBSERVED',attestation:'NONE',authority:'NONE',admission:'BLOCKED',localExecute:false,isolationConfirmed:false,adminit:'SECURITY_HOLD',phase2:'BLOCKED'});
export const lockedHostResult=()=>report('NOT_RUN','HOST_ACCEPTANCE_MISSING','LIVE_GATE');
const tickets=new WeakMap();
export function checkHostEvidence(envelope,policy,now=Date.now()){let stage='ENVELOPE';try{
 exact(policy,['publicKey','controllerKeySha256','hostIdentitySha256','vmIdentitySha256','ledgerIdentitySha256','sourceHead','sourceTree','payloadSha256','nodeSha256','attemptNonceSha256','ledgerGeneration','minWatermarkSequence','minWatermarkThroughMs']);
 for(const k of Object.keys(policy).filter(k=>!['publicKey','ledgerGeneration','minWatermarkSequence','minWatermarkThroughMs'].includes(k)))need(hex(policy[k],['sourceHead','sourceTree'].includes(k)?40:64));
 for(const k of ['ledgerGeneration','minWatermarkSequence','minWatermarkThroughMs'])need(Number.isSafeInteger(policy[k])&&policy[k]>=0);need(policy.ledgerGeneration>0);
 need(typeof policy.publicKey==='string'&&policy.publicKey.startsWith('-----BEGIN PUBLIC KEY-----')&&policy.publicKey.length<=1024);
 exact(envelope,['payload','signature']);need(typeof envelope.payload==='string'&&Buffer.byteLength(envelope.payload)<=16384&&typeof envelope.signature==='string'&&envelope.signature.length===88);
 const key=createPublicKey(policy.publicKey),sig=Buffer.from(envelope.signature,'base64');need(key.asymmetricKeyType==='ed25519'&&sha(key.export({type:'spki',format:'der'}))===policy.controllerKeySha256&&sig.length===64&&sig.toString('base64')===envelope.signature&&verify(null,Buffer.from(envelope.payload),key,sig));
 const b=JSON.parse(envelope.payload);need(JSON.stringify(b)===envelope.payload);exact(b,['schema','phase','issuedAtMs','expiresAtMs','identity','source','network','account','av','ledger','job','result']);need(b.schema==='math.vm-host-evidence.v1'&&['PRELAUNCH','COMPLETION'].includes(b.phase));
 stage='FRESHNESS';need(Number.isSafeInteger(now)&&Number.isSafeInteger(b.issuedAtMs)&&Number.isSafeInteger(b.expiresAtMs)&&b.issuedAtMs>=0&&b.issuedAtMs<=now&&now<b.expiresAtMs&&b.expiresAtMs-b.issuedAtMs<=5000);
 stage='IDENTITY';exact(b.identity,['controllerKeySha256','hostIdentitySha256','vmIdentitySha256','collection','proofSha256']);for(const k of ['controllerKeySha256','hostIdentitySha256','vmIdentitySha256'])need(b.identity[k]===policy[k]);need(b.identity.collection==='HOST_CONTROL_PLANE'&&hex(b.identity.proofSha256,64));
 exact(b.source,['sourceHead','sourceTree','payloadSha256','nodeSha256','attemptNonceSha256']);for(const k of Object.keys(b.source))need(b.source[k]===policy[k]);
 stage='NETWORK';exact(b.network,['coverage','proofSha256']);exact(b.network.coverage,COVERAGE);need(hex(b.network.proofSha256,64));for(const k of COVERAGE)need(b.network.coverage[k]==='ISOLATED');
 stage='ACCOUNT';exact(b.account,['class','elevated','adminEnabled','launchContext','proofSha256']);need(b.account.class==='STANDARD_USER'&&b.account.elevated===false&&b.account.adminEnabled===false&&b.account.launchContext==='BROKER_BOUND'&&hex(b.account.proofSha256,64));
 stage='AV';exact(b.av,['health','protection','signatures','providerProofSha256','sampledAtMs','watermarkThroughMs','watermarkSequence','lostEvents','alert','deliveryBoundMs','continuousFromMs']);const a=b.av;need(a.health==='HEALTHY'&&a.protection==='ENABLED'&&a.signatures==='ACCEPTED'&&hex(a.providerProofSha256,64)&&a.alert==='NONE'&&a.lostEvents===0);
 for(const k of ['sampledAtMs','watermarkThroughMs','watermarkSequence','deliveryBoundMs','continuousFromMs'])need(Number.isSafeInteger(a[k])&&a[k]>=0);
 need(a.sampledAtMs<=now&&now-a.sampledAtMs<=100&&a.watermarkThroughMs<=a.sampledAtMs&&a.sampledAtMs-a.watermarkThroughMs<=100&&a.deliveryBoundMs>0&&a.deliveryBoundMs<=1000&&a.continuousFromMs<=a.watermarkThroughMs&&a.watermarkSequence>policy.minWatermarkSequence&&a.watermarkThroughMs>=policy.minWatermarkThroughMs);
 stage='LEDGER';exact(b.ledger,['identitySha256','placement','snapshotExcluded','generation','proofSha256','state']);need(b.ledger.identitySha256===policy.ledgerIdentitySha256&&b.ledger.placement==='HOST_NONROLLBACK'&&b.ledger.snapshotExcluded===true&&Number.isSafeInteger(b.ledger.generation)&&b.ledger.generation===policy.ledgerGeneration&&hex(b.ledger.proofSha256,64)&&b.ledger.state===(b.phase==='PRELAUNCH'?'UNRESERVED':'SPENT'));
 stage='JOB';exact(b.job,[...Object.keys(JOB),'proofSha256']);for(const k of Object.keys(JOB))need(b.job[k]===JOB[k]);need(hex(b.job.proofSha256,64));
 stage='RESULT';const r=b.result;exact(r,['launches','exitCode','stdoutBytes','stderrBytes','assignedAtMs','resumedAtMs','exitedAtMs','reapedAtMs','remainingProcesses','stdoutSha256','assignedSequence','resumedSequence']);
 if(b.phase==='PRELAUNCH'){need(r.launches===0&&r.exitCode===null&&r.stdoutBytes===0&&r.stderrBytes===0);for(const k of ['assignedAtMs','resumedAtMs','exitedAtMs','reapedAtMs','remainingProcesses','stdoutSha256','assignedSequence','resumedSequence'])need(r[k]===null);}
 else{need(r.launches===1&&r.exitCode===0&&r.stdoutBytes===Buffer.byteLength(marker)&&r.stderrBytes===0&&r.remainingProcesses===0&&r.stdoutSha256===sha(marker)&&Number.isSafeInteger(r.assignedSequence)&&Number.isSafeInteger(r.resumedSequence)&&r.assignedSequence>=0&&r.assignedSequence<r.resumedSequence);for(const k of ['assignedAtMs','resumedAtMs','exitedAtMs','reapedAtMs'])need(Number.isSafeInteger(r[k])&&r[k]>=0);need(r.assignedAtMs<=r.resumedAtMs&&r.resumedAtMs<=r.exitedAtMs&&r.exitedAtMs-r.resumedAtMs<=JOB.wallMs&&r.exitedAtMs<=r.reapedAtMs&&r.reapedAtMs<=a.sampledAtMs&&a.continuousFromMs<=r.assignedAtMs&&a.watermarkThroughMs>=r.exitedAtMs&&a.sampledAtMs-r.exitedAtMs>=a.deliveryBoundMs);}
 const reservation=Object.freeze({});if(b.phase==='PRELAUNCH')tickets.set(reservation,{expiresAtMs:b.expiresAtMs,validatedAtMs:now,sampledAtMs:a.sampledAtMs,watermarkThroughMs:a.watermarkThroughMs,ledgerIdentitySha256:policy.ledgerIdentitySha256,generation:policy.ledgerGeneration,nonce:policy.attemptNonceSha256,binding:sha(envelope.payload),spent:false});
 return{result:report('PASS','CLAIMS_VALIDATED_NOT_ACCEPTED'),reservation:b.phase==='PRELAUNCH'?reservation:null};
}catch{return{result:report('BLOCKED',stage),reservation:null};}}
// Creates a private wire request only: no filesystem, backend call or launch.
export function prepareLedgerRequest(reservation,now=Date.now()){try{
 const t=tickets.get(reservation);need(t&&!t.spent);t.spent=true;need(Number.isSafeInteger(now)&&now>=t.validatedAtMs&&now<t.expiresAtMs&&now-t.sampledAtMs<=100&&now-t.watermarkThroughMs<=100);
 const request=Object.freeze({schema:'math.host-ledger-claim.v1',ledgerIdentitySha256:t.ledgerIdentitySha256,generation:t.generation,attemptNonceSha256:t.nonce,idempotencyKeySha256:sha(t.ledgerIdentitySha256+':'+t.nonce),bindingSha256:t.binding,expiresAtMs:t.expiresAtMs});
 return{result:report('NOT_RUN','HOST_LEDGER_BACKEND_MISSING','LEDGER_WIRE_ONLY'),request};
}catch{return{result:report('BLOCKED','RESERVATION_INVALID_OR_STALE','LEDGER_WIRE_ONLY'),request:null};}}
