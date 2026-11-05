import {openSync,closeSync,fstatSync,readSync} from 'node:fs';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
export function processDiagnosticLines(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>2048)return [];
 const lines=text.split(/\r?\n/).filter(Boolean);if(lines.length!==1)return [];
 const m=/^PROCESS_DIAGNOSTIC name=SYSTEM_CMD outcome=(ENTRY_REACHED|DLL_INITIALIZATION_FAILED|DLL_NOT_FOUND|INVALID_IMAGE_FORMAT|OTHER_EXIT|DEADLINE|UNAVAILABLE|CLEANUP_UNCONFIRMED) pin=(BUILD_HOST_OS_PIN_MATCHED|UNAVAILABLE) qualification=NONE$/.exec(lines[0]);
 return m&&(m[2]!=='UNAVAILABLE'||m[1]==='UNAVAILABLE')?lines:[];
}
export function clrDiagnosticLines(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>2048)return [];
 const out=[],seen=new Set();
 for(const line of text.split(/\r?\n/).filter(Boolean)){
  const m=/^HOSTED_CLR_DIAGNOSTIC variant=(BASE|SYSTEM_PATH|OWNED_PROFILE|SYSTEM_PROGRAMDATA|PRIVATE_NONINTERACTIVE|SETUP|CLEANUP) outcome=(CLR_ENTRY_REACHED|DLL_INITIALIZATION_FAILED|DLL_NOT_FOUND|INVALID_IMAGE_FORMAT|OTHER_EXIT|DEADLINE|UNAVAILABLE|CLEANUP_UNCONFIRMED) qualification=NONE$/.exec(line);
  if(!m||seen.has(m[1])||(m[1]==='SETUP'&&!['DEADLINE','UNAVAILABLE'].includes(m[2]))||(m[1]==='CLEANUP'&&m[2]!=='CLEANUP_UNCONFIRMED'))return [];
  seen.add(m[1]);out.push(line);
 }
 return out;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 let fd,lines=[];try{if(process.argv.length!==3)throw Error();fd=openSync(process.argv[2],'r');const s=fstatSync(fd);if(!s.isFile()||s.size>2048)throw Error();const b=Buffer.alloc(2049),n=readSync(fd,b,0,b.length,0);const raw=b.subarray(0,n).toString('utf8').split(/\r?\n/).filter(Boolean),clr=clrDiagnosticLines(raw.filter(x=>x.startsWith('HOSTED_CLR_DIAGNOSTIC ')).join('\n')),control=processDiagnosticLines(raw.filter(x=>x.startsWith('PROCESS_DIAGNOSTIC ')).join('\n'));lines=clr.length+control.length===raw.length?[...clr,...control]:[];}catch{}finally{if(fd!==undefined)try{closeSync(fd);}catch{lines=[];}}
 for(const line of lines)console.log(line);
 if(lines.length===0)console.log('HOSTED_CLR_DIAGNOSTIC variant=SETUP outcome=UNAVAILABLE qualification=NONE');
}
