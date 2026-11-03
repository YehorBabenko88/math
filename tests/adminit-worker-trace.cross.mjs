import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,rmSync,linkSync,symlinkSync,unlinkSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseWorkerTrace,readWorkerTrace,publishWorkerTrace} from '../scripts/adminit-containment/preflight-trace.mjs';
test('worker trace accepts only bounded complete fixed phases and rejects misleading partial output',()=>{
 assert.equal(parseWorkerTrace(Buffer.alloc(0)),'NO_MARKER');
 for(const phase of ['RUNTIME','REPARSE','TYPES','PARSER','COMPILE','EXIT'])assert.equal(parseWorkerTrace(Buffer.from(phase+'\n')),phase);
 for(const text of ['COMPILE','COMPILE\nEXIT\n','secret\n','RUNTIME\r\n','X'.repeat(257),'COMPILE\n\0'])assert.equal(parseWorkerTrace(Buffer.from(text)),'UNAVAILABLE');
 assert.equal(parseWorkerTrace('COMPILE\n'),'UNAVAILABLE');
});
test('pinned preflight entry rejects policy without executing a modified adjacent trace helper',()=>{
 const root=mkdtempSync(join(tmpdir(),'preflight-bootstrap-'));
 try{const entry=join(root,'offline-preflight.mjs'),marker=join(root,'must-not-exist');const source=readFileSync(new URL('../scripts/adminit-containment/offline-preflight.mjs',import.meta.url),'utf8');
  for(const match of source.matchAll(/^import .*? from ['"]([^'"]+)['"]/gm))assert.ok(match[1].startsWith('node:'),'pinned entry imports built-ins only');
  writeFileSync(entry,source,{flag:'wx'});writeFileSync(join(root,'preflight-trace.mjs'),"import{writeFileSync}from'node:fs';writeFileSync("+JSON.stringify(marker)+",'UNVERIFIED_HELPER_EXECUTED');export const readWorkerTrace=()=>{};export const publishWorkerTrace=()=>{};",{flag:'wx'});
  const child=spawnSync(process.execPath,[entry,'--source',root,'--policy',join(root,'missing-policy.json'),'--policy-sha256','0'.repeat(64)],{encoding:'utf8',timeout:10000,windowsHide:true,maxBuffer:2048});
  assert.equal(child.error,undefined);assert.equal(child.status,2);assert.equal(child.stderr,'');assert.equal(JSON.parse(child.stdout).status,'BLOCKED');assert.equal(existsSync(marker),false,'unverified adjacent source must never execute');
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('worker diagnostic sink is empty owned regular file and never overwrites existing or linked data',()=>{
 const root=mkdtempSync(join(tmpdir(),'worker-trace-'));
 try{const dir=join(root,'worker-diagnostic-123456');mkdirSync(dir);const sink=join(dir,'phase.txt');writeFileSync(sink,'',{flag:'wx'});
  assert.equal(publishWorkerTrace(sink,root,'COMPILE'),true);assert.equal(readFileSync(sink,'utf8'),'COMPILE\n');assert.equal(publishWorkerTrace(sink,root,'EXIT'),false);assert.equal(readWorkerTrace(sink),'COMPILE');
  const other=join(dir,'other');writeFileSync(other,'');assert.equal(publishWorkerTrace(other,root,'EXIT'),false);
  const alias=join(root,'worker-diagnostic-abcdef');symlinkSync(dir,alias,process.platform==='win32'?'junction':'dir');try{assert.equal(readWorkerTrace(join(alias,'phase.txt')),'UNAVAILABLE');assert.equal(publishWorkerTrace(join(alias,'phase.txt'),root,'EXIT'),false);}finally{unlinkSync(alias);}
  const linked=join(root,'linked');linkSync(sink,linked);assert.equal(readWorkerTrace(sink),'UNAVAILABLE');assert.equal(publishWorkerTrace(sink,root,'EXIT'),false);
  assert.equal(publishWorkerTrace(sink,root,'PRIVATE_PATH'),false);
 }finally{rmSync(root,{recursive:true,force:true});}
});
