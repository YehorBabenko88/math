import {mkdir,writeFile,readdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export async function writeEvidence({directory,source,profile,expectedCases,results,events}) {
 if(!source || !/^[a-f0-9]{40}$/.test(source.head)||!/^[a-f0-9]{40}$/.test(source.tree)||!['queueSha256','contractSha256','textSha256'].every(k=>/^[a-f0-9]{64}$/.test(source[k])))throw Error('Invalid source identity');
 if(typeof profile!=='string'||!profile||!Array.isArray(expectedCases)||!expectedCases.length||expectedCases.some(x=>typeof x!=='string'||!x)||new Set(expectedCases).size!==expectedCases.length)throw Error('Invalid case inventory');
 if(!Array.isArray(results)||results.length!==expectedCases.length||new Set(results.map(x=>x.id)).size!==results.length)throw Error('Incomplete results');
 for(const r of results)if(!expectedCases.includes(r.id)||!['PASS','FAIL','BLOCKED'].includes(r.status)||typeof r.reason!=='string'||!Array.isArray(r.assertions)||!r.assertions.length||r.assertions.some(a=>typeof a.name!=='string'||!a.name||typeof a.pass!=='boolean')||new Set(r.assertions.map(a=>a.name)).size!==r.assertions.length||(r.status==='PASS'&&r.assertions.some(a=>!a.pass)))throw Error('Invalid case result');
 if(!Array.isArray(events)||!events.length)throw Error('Missing events');
 let prior=-1n;for(const [i,e] of events.entries()){if(e.seq!==i+1||!expectedCases.includes(e.caseId)||typeof e.workerId!=='string'||!e.workerId||typeof e.event!=='string'||!e.event||typeof e.atNs!=='string'||!/^\d+$/.test(e.atNs)||BigInt(e.atNs)<prior||!e.data||typeof e.data!=='object'||Array.isArray(e.data))throw Error('Invalid event timeline');prior=BigInt(e.atNs);}
 for(const id of expectedCases)if(!events.some(e=>e.caseId===id))throw Error('Missing case events');
 const status=results.some(r=>r.status==='FAIL')?'FAIL':results.some(r=>r.status==='BLOCKED')?'BLOCKED':'PASS';
 const report={schemaVersion:1,source,profile,expectedCases,results,status,q01Status:'OPEN',eventCount:events.length,provenance:'Self-reported run evidence; hashes establish integrity, not independent attestation.'};
 const failures=results.filter(r=>r.status!=='PASS').length;
 const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="q01" tests="${results.length}" failures="${failures}" errors="0" skipped="0">\n${results.map(r=>`<testcase classname="q01.${esc(profile)}" name="${esc(r.id)}"><properties>${r.assertions.map(a=>`<property name="${esc(a.name)}" value="${a.pass}"/>`).join('')}</properties>${r.status==='PASS'?'':`<failure type="${r.status}" message="${esc(r.reason)}"/>`}</testcase>`).join('\n')}\n</testsuite>\n`;
 await mkdir(directory,{recursive:true});const ds=await lstat(directory);if(!ds.isDirectory()||ds.isSymbolicLink())throw Error('Unsafe directory');if((await readdir(directory)).length)throw Error('Evidence directory must be empty');
 const contents={'events.jsonl':events.map(e=>JSON.stringify(e)).join('\n')+'\n','junit.xml':xml,'report.json':JSON.stringify(report,null,2)+'\n'};
 const files={};for(const [name,body]of Object.entries(contents)){await writeFile(join(directory,name),body,{flag:'wx'});files[name]=createHash('sha256').update(body).digest('hex');}
 await writeFile(join(directory,'manifest.json'),JSON.stringify({schemaVersion:1,algorithm:'sha256',files},null,2)+'\n',{flag:'wx'});
 return {report,files:Object.keys({...contents,'manifest.json':''}).map(f=>join(directory,f))};
}
