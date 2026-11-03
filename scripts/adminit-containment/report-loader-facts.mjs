// Closed public grammar only. No paths, SIDs, descriptors or raw child streams.
const labels=['LOW','MEDIUM','HIGH','SYSTEM','OTHER','UNLABELLED','UNAVAILABLE'];
export function loaderFactLines(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>16384)return [];
 const out=[],seen=new Set();
 for(const line of text.split(/\r?\n/)){
  if(line.startsWith('HOSTED_TOKEN_FACT ')){
   const m=/^HOSTED_TOKEN_FACT name=(PARENT|LIMITED|CHILD) available=(true|false) integrity=([A-Z_]+) elevation=(DEFAULT|FULL|LIMITED|UNAVAILABLE) kind=(PRIMARY|IMPERSONATION|UNAVAILABLE) restricted=(true|false) admin_enabled=(true|false) admin_deny_only=(true|false) same_user=(true|false) same_session=(true|false)$/.exec(line);
   if(!m||seen.has('TOKEN_'+m[1])||!labels.includes(m[3])||m[3]==='UNLABELLED'||(m[2]==='false'&&(m[3]!=='UNAVAILABLE'||m[4]!=='UNAVAILABLE'||m[5]!=='UNAVAILABLE'||m.slice(6).some(x=>x!=='false')))||(m[2]==='true'&&(m[3]==='UNAVAILABLE'||m[4]==='UNAVAILABLE'||m[5]==='UNAVAILABLE')))return [];
   seen.add('TOKEN_'+m[1]);out.push(line);
  }else if(line.startsWith('HOSTED_TOKEN_EXTRA ')){
   const m=/^HOSTED_TOKEN_EXTRA name=(PARENT|LIMITED|CHILD) available=(true|false) change_notify_present=(true|false) change_notify_enabled=(true|false) logon_present=(true|false) logon_enabled=(true|false) same_logon=(true|false) restricting_sid_count=(0|[1-9][0-9]{0,3})$/.exec(line);
   if(!m||seen.has('EXTRA_'+m[1])||Number(m[8])>1024||(m[2]==='false'&&(m.slice(3,8).some(x=>x!=='false')||m[8]!=='0'))||(m[3]==='false'&&m[4]==='true')||(m[5]==='false'&&(m[6]==='true'||m[7]==='true')))return [];
   seen.add('EXTRA_'+m[1]);out.push(line);
  }else if(line.startsWith('HOSTED_LOADER_EVENT ')){
   const m=/^HOSTED_LOADER_EVENT name=(CI_3033|CI_3034|CI_3076|CI_3077|CI_3089|APPLOCKER_8002|APPLOCKER_8003|APPLOCKER_8004|DEFENDER_1121|DEFENDER_1122|APPLICATION_1000|APPLICATION_1001|APPLICATION_1026) available=(true|false) pid_matches=(0|[1-9][0-9]?) image_matches=(0|[1-9][0-9]?) class=(NONE|QUERY_UNAVAILABLE|RENDER_UNAVAILABLE|RENDER_BOUNDS|XML_REJECTED|ENUMERATION_UNAVAILABLE|BUDGET_EXHAUSTED|TRUNCATED|HANDLE_CLOSE_FAILED)$/.exec(line);
   if(!m||seen.has('EVENT_'+m[1])||Number(m[3])+Number(m[4])>64||(m[2]==='true'&&!['NONE','TRUNCATED','BUDGET_EXHAUSTED'].includes(m[5]))||(m[2]==='false'&&(m[3]!=='0'||m[4]!=='0'||m[5]==='NONE')))return [];
   seen.add('EVENT_'+m[1]);out.push(line);
  }else if(line.startsWith('HOSTED_RUNTIME_FACT ')){
   const m=/^HOSTED_RUNTIME_FACT name=(SHIM|CLR|JIT|CORELIB) available=(true|false) pin_match=(true|false) allowed=(true|false) label=([A-Z_]+) no_write_up=(true|false) no_read_up=(true|false) no_execute_up=(true|false) class=(NONE|PIN_MISMATCH|RUNTIME_UNAVAILABLE)$/.exec(line);
   if(!m||seen.has('RUNTIME_'+m[1])||!labels.includes(m[5])||(m[2]==='true'?(m[3]!=='true'||m[5]==='UNAVAILABLE'||m[9]!=='NONE'):(m[4]!=='false'||m[9]==='NONE'))||(m[5]==='UNAVAILABLE'&&m.slice(6,9).some(x=>x!=='false')))return [];
   seen.add('RUNTIME_'+m[1]);out.push(line);
  }
 }
 return out;
}
