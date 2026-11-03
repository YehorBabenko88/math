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
  }else if(line.startsWith('HOSTED_RUNTIME_FACT ')){
   const m=/^HOSTED_RUNTIME_FACT name=(SHIM|CLR|JIT|CORELIB) available=(true|false) pin_match=(true|false) allowed=(true|false) label=([A-Z_]+) no_write_up=(true|false) no_read_up=(true|false) no_execute_up=(true|false) class=(NONE|PIN_MISMATCH|RUNTIME_UNAVAILABLE)$/.exec(line);
   if(!m||seen.has('RUNTIME_'+m[1])||!labels.includes(m[5])||(m[2]==='true'?(m[3]!=='true'||m[5]==='UNAVAILABLE'||m[9]!=='NONE'):(m[4]!=='false'||m[9]==='NONE'))||(m[5]==='UNAVAILABLE'&&m.slice(6,9).some(x=>x!=='false')))return [];
   seen.add('RUNTIME_'+m[1]);out.push(line);
  }
 }
 return out;
}
