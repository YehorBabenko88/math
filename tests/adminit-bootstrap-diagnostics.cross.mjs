import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bootstrapPhase,BOOTSTRAP_PHASES} from '../scripts/adminit-containment/report-bootstrap-phase.mjs';

test('hosted bootstrap public phases are bounded fixed labels without raw stream disclosure',()=>{
 assert.equal(bootstrapPhase('private path and token\nHOSTED_BOOTSTRAP_PHASE=TOKEN_CREATE\r\n'),'TOKEN_CREATE');
 assert.equal(bootstrapPhase('HOSTED_BOOTSTRAP_PHASE=PRIVATE_TOKEN\n'),'UNKNOWN');
 assert.equal(bootstrapPhase('prefix HOSTED_BOOTSTRAP_PHASE=TOKEN_CREATE\n'),'UNKNOWN');
 assert.equal(bootstrapPhase('x'.repeat(16385)),'UNKNOWN');
 const source=readFileSync(new URL('../tests/fixtures/adminit-containment/HostedMediumLauncher.cs',import.meta.url),'utf8');
 for(const [,phase] of source.matchAll(/phase="([A-Z_]+)"/g))assert.ok(BOOTSTRAP_PHASES.includes(phase));
 assert.match(source,/HOSTED_BOOTSTRAP_PHASE=/);
 const directory=mkdtempSync(join(tmpdir(),'math-bootstrap-public-'));
 try{
  const path=join(directory,'private-stdout.txt');writeFileSync(path,'secret machine paths\nHOSTED_BOOTSTRAP_PHASE=PROCESS_CREATE\n');
  const child=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/adminit-containment/report-bootstrap-phase.mjs',import.meta.url)),path],{encoding:'utf8',timeout:10000,maxBuffer:4096,windowsHide:true});
  assert.equal(child.status,0);assert.equal(child.stderr,'');assert.equal(child.stdout.trim(),'HOSTED_BOOTSTRAP_FAILURE phase=PROCESS_CREATE');
 }finally{rmSync(directory,{recursive:true,force:true});}
});
