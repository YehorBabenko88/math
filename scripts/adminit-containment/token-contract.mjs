import{resolve}from'node:path';import{fileURLToPath}from'node:url';
import {exact,need,blocked,strictJson} from '../../src/evidence-receiver/strict.mjs';
const stages=['NONE','UNKNOWN','OS','LOAD','OPEN','Q1','Q2','Q3','Q4','Q5','Q6','Q7','T1','T2','T3','POLICY','CLEANUP'];
const categories=['NONE','UNKNOWN','OS','LOAD','OPEN','PROBE','READ','BOUNDS','CLOSE','CLEANUP','IDENTITY','IMPERSONATION','INTERNAL'];
function validateDiagnostic(r){
 const s=r.diagnosticStage,c=r.diagnosticCategory;
 need(stages.includes(s)&&categories.includes(c));
 if(r.apiStatus==='OK'){need(s==='NONE'&&c==='NONE');return;}
 // Pure policy/unattributed failures carry no invented API location.
 if(s==='UNKNOWN'){need(c==='UNKNOWN');return;}
 need(s!=='NONE'&&c!=='NONE'&&c!=='UNKNOWN');
 const q=/^Q[1-7]$/.test(s),t=/^T[1-3]$/.test(s);
 const valid={
 E_QUERY:(q&&['PROBE','READ','BOUNDS'].includes(c))||(t&&['PROBE','BOUNDS'].includes(c)),
 E_FORMAT:(q||s==='POLICY')&&c==='BOUNDS',
 E_CLOSE:(t||s==='Q7'||s==='CLEANUP')&&c==='CLOSE',
 E_OPEN:(s==='OPEN'||s==='Q7')&&c==='OPEN',
 E_CHANGED:s==='POLICY'&&c==='IDENTITY',
 E_IMPERSONATION:t&&c==='IMPERSONATION',
 E_OS:s==='OS'&&c==='OS',E_LOAD:s==='LOAD'&&c==='LOAD',
 E_INTERNAL:(q&&['PROBE','READ','BOUNDS','CLEANUP'].includes(c))||(t&&c==='PROBE')||(s==='OPEN'&&c==='OPEN')||(s==='POLICY'&&['BOUNDS','IDENTITY'].includes(c))||(s==='CLEANUP'&&c==='CLEANUP')
 };
 need(valid[r.code]===true);
}
export function validateTokenObservation(r) {
 try {
  const v2=r?.schema==='math.g0.token-api.v2';
  exact(r,['schema','scope','apiStatus','status','code','tokenType','integrityRid','elevated','adminEnabled','authority','isolationConfirmed','localExecute','admission',...(v2?['diagnosticStage','diagnosticCategory']:[])]);
  need((r.schema==='math.g0.token-api.v1'||v2)&&r.scope==='CURRENT_PROCESS_OBSERVATION'&&r.authority==='NONE'&&r.isolationConfirmed===false&&r.localExecute===false&&r.admission==='BLOCKED');
  if(r.apiStatus==='ERROR') {
   need(r.status==='UNKNOWN'&&['E_OS','E_OPEN','E_QUERY','E_FORMAT','E_CHANGED','E_IMPERSONATION','E_CLOSE','E_LOAD','E_INTERNAL'].includes(r.code)&&r.tokenType==='UNKNOWN'&&r.integrityRid===null&&r.elevated===null&&r.adminEnabled===null);
  } else {
   need(r.apiStatus==='OK'&&r.code==='NONE'&&r.tokenType==='PRIMARY'&&Number.isSafeInteger(r.integrityRid)&&r.integrityRid>=0&&r.integrityRid<=4294967295&&typeof r.elevated==='boolean'&&typeof r.adminEnabled==='boolean');
   const status=r.integrityRid===8192&&!r.elevated&&!r.adminEnabled?'PASS':'FAIL';need(r.status===status);
  }
  if(v2)validateDiagnostic(r);
  return Object.freeze({...r});
 } catch {blocked();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {need(process.argv.length===2);let text='';for await(const b of process.stdin){text+=b.toString('utf8');need(Buffer.byteLength(text)<=16384);}console.log(JSON.stringify(validateTokenObservation(strictJson(text,16384))));process.exitCode=2;}
 catch {console.error('G0_TOKEN_OBSERVATION_BLOCKED');process.exitCode=2;}
}
