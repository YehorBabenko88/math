import {createPublicKey, verify as verifySignature} from 'node:crypto';
import {types} from 'node:util';
import {safeJson,canonicalJSON,sha256} from './json.mjs';

const fields=['version','issuer','audience','subject','sessionId','issuedAt','expiresAt','runId','resourceId','scopes'];
const allowedScopes=new Set(['prepare','quiesce','backup','transfer','verify','activate']);
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const invalid=()=>{throw Error('Invalid operator session');};
function inert(input){
 let count=0;const seen=new Set();
 function check(value,depth){
  if(++count>256||depth>8)invalid();
  if(value===null||typeof value!=='object')return;
  if(types.isProxy(value)||seen.has(value))invalid();seen.add(value);
  for(const key of Reflect.ownKeys(value)){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!Object.hasOwn(descriptor,'value'))invalid();check(descriptor.value,depth+1);}
 }
 check(input,0);return safeJson(input,{maxBytes:8192});
}
// The identity provider signs these bytes externally. This module never issues sessions.
export function operatorSessionSigningBytes(input){
 const claims=inert(input);if(!claims||typeof claims!=='object'||Array.isArray(claims))invalid();
 const unsigned={};for(const key of Object.keys(claims))if(key!=='signature')unsigned[key]=claims[key];
 return Buffer.from(canonicalJSON(unsigned),'utf8');
}
// Runtime public-key provisioning remains an operational prerequisite, not a library guarantee.
export function createOperatorSessionVerifier({publicKey,issuer,audience,now=Date.now,maxTtlMs=900000}){
 if(!identifier(issuer)||!identifier(audience)||typeof now!=='function'||!Number.isSafeInteger(maxTtlMs)||maxTtlMs<=0||maxTtlMs>900000)invalid();
 if(publicKey?.type==='private')invalid();
 let key;try{key=publicKey?.type==='public'?createPublicKey({key:publicKey.export({type:'spki',format:'der'}),type:'spki',format:'der'}):createPublicKey(publicKey);}catch{invalid();}
 if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')invalid();
 return Object.freeze({verify(input,context){
  try{
   const session=inert(input),binding=inert(context);
   if(!session||typeof session!=='object'||Array.isArray(session)||Object.keys(session).length!==fields.length+1||![...fields,'signature'].every(field=>Object.hasOwn(session,field)))invalid();
   if(!binding||Object.keys(binding).length!==3||!['runId','resourceId','scope'].every(field=>Object.hasOwn(binding,field)))invalid();
   if(session.version!=='book-operator-session/v1'||session.issuer!==issuer||session.audience!==audience||!identifier(session.subject)||!identifier(session.sessionId))invalid();
   if(!uuid(session.runId)||!hash(session.resourceId)||session.runId!==binding.runId||session.resourceId!==binding.resourceId||!allowedScopes.has(binding.scope))invalid();
   if(!Array.isArray(session.scopes)||!session.scopes.length||session.scopes.length>6||new Set(session.scopes).size!==session.scopes.length||session.scopes.some(scope=>!allowedScopes.has(scope))||!session.scopes.includes(binding.scope))invalid();
   const time=now();if(!Number.isSafeInteger(time)||!Number.isSafeInteger(session.issuedAt)||!Number.isSafeInteger(session.expiresAt)||session.issuedAt<0||session.issuedAt>time||time>=session.expiresAt||session.expiresAt-session.issuedAt>maxTtlMs)invalid();
   if(typeof session.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(session.signature))invalid();
   const signature=Buffer.from(session.signature,'base64url');if(signature.toString('base64url')!==session.signature)invalid();
   const bytes=operatorSessionSigningBytes(session);if(!verifySignature(null,bytes,key,signature))invalid();
   return Object.freeze({actorHash:sha256(canonicalJSON([issuer,session.subject,session.sessionId])),expiresAt:session.expiresAt,sessionHash:sha256(Buffer.concat([bytes,Buffer.from(session.signature)]))});
  }catch{invalid();}
 }});
}
