import{resolve}from'node:path';import{fileURLToPath}from'node:url';
import {exact,need,blocked,strictJson} from '../../src/evidence-receiver/strict.mjs';
export function validateTokenObservation(r) {
 try {
  exact(r,['schema','scope','apiStatus','status','code','tokenType','integrityRid','elevated','adminEnabled','authority','isolationConfirmed','localExecute','admission']);
  need(r.schema==='math.g0.token-api.v1'&&r.scope==='CURRENT_PROCESS_OBSERVATION'&&r.authority==='NONE'&&r.isolationConfirmed===false&&r.localExecute===false&&r.admission==='BLOCKED');
  if(r.apiStatus==='ERROR') {
   need(r.status==='UNKNOWN'&&['E_OS','E_OPEN','E_QUERY','E_FORMAT','E_CHANGED','E_IMPERSONATION','E_CLOSE','E_LOAD','E_INTERNAL'].includes(r.code)&&r.tokenType==='UNKNOWN'&&r.integrityRid===null&&r.elevated===null&&r.adminEnabled===null);
  } else {
   need(r.apiStatus==='OK'&&r.code==='NONE'&&r.tokenType==='PRIMARY'&&Number.isSafeInteger(r.integrityRid)&&r.integrityRid>=0&&r.integrityRid<=4294967295&&typeof r.elevated==='boolean'&&typeof r.adminEnabled==='boolean');
   const status=r.integrityRid===8192&&!r.elevated&&!r.adminEnabled?'PASS':'FAIL';need(r.status===status);
  }
  return Object.freeze({...r});
 } catch {blocked();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {need(process.argv.length===2);let text='';for await(const b of process.stdin){text+=b.toString('utf8');need(Buffer.byteLength(text)<=16384);}console.log(JSON.stringify(validateTokenObservation(strictJson(text,16384))));process.exitCode=2;}
 catch {console.error('G0_TOKEN_OBSERVATION_BLOCKED');process.exitCode=2;}
}
