import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadInventory,sha256,validateCoverage,cells} from './platform-coverage.mjs';
const directory=process.argv[2];assert.equal(process.argv.length,3,'Exact artifact directory required');
const root=resolve(directory);assert.deepEqual(readdirSync(root).sort(),cells.map(x=>'platform-'+x).sort(),'Exact six artifact directories');
function find(path,name){const matches=[];for(const item of readdirSync(path,{withFileTypes:true})){const file=join(path,item.name);assert.equal(lstatSync(file).isSymbolicLink(),false);if(item.isDirectory())matches.push(...find(file,name));else if(item.name===name)matches.push(file);}return matches;}
const receipts=[];
for(const cell of cells){
 const artifact=join(root,'platform-'+cell);const files=find(artifact,'receipt.json');assert.equal(files.length,1,'One receipt per artifact');const receipt=JSON.parse(readFileSync(files[0],'utf8'));assert.equal(receipt.cell,cell,'Artifact cell label');
 const events=find(artifact,'events.ndjson');assert.equal(events.length,1);receipt.eventsRaw=readFileSync(events[0],'utf8');
 const proofs=find(artifact,'release-provenance.json');assert.equal(proofs.length,1,'Actual tested-source provenance');const proof=JSON.parse(readFileSync(proofs[0],'utf8'));
 for(const [field,value] of Object.entries({sourceSha:receipt.head,committedTreeSha:receipt.tree,runId:receipt.runId,runAttempt:receipt.attempt,testedWorktreeVerified:true,qualified:true}))assert.equal(proof[field],value,'Source/dependency provenance '+field);
 receipts.push(receipt);
}
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{encoding:'utf8'}).trim();
const result=validateCoverage(receipts,{inventory:loadInventory(),head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,sourceProofSha:sha256(JSON.stringify(JSON.parse(readFileSync('scripts/platform-source-proof.json','utf8'))))});
writeFileSync('mandatory-platform-coverage.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
