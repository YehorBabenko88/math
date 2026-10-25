import{execFileSync}from'node:child_process';import{resolve}from'node:path';import{fileURLToPath}from'node:url';
export const requiredInputs=Object.freeze(['scripts/adminit-containment/build-hosted.ps1','scripts/adminit-containment/verify-build-inputs.mjs','scripts/adminit-containment/package.mjs','scripts/adminit-containment/verify-native.mjs','scripts/adminit-containment/verify-adminit.ps1','scripts/q01-lab/WindowsJobContainment.cs','tests/fixtures/adminit-containment/AdminitSynthetic.cs','tests/fixtures/adminit-containment/HostedMediumLauncher.cs']);
export function validateBuildEntries(entries){
 if(!Array.isArray(entries)||entries.length!==requiredInputs.length||new Set(entries.map(e=>e?.path)).size!==requiredInputs.length||entries.some(e=>e?.mode!=='100644'||e.type!=='blob'||typeof e.oid!=='string'||!/^[a-f0-9]{40}$/.test(e.oid)||!requiredInputs.includes(e.path)))throw Error('Build inputs BLOCKED: missing, duplicate or nonregular committed input');return true;
}
export function verifyCommittedBuildInputs(sourceHead){
 if(typeof sourceHead!=='string'||!/^[a-f0-9]{40}$/.test(sourceHead))throw Error('Build inputs BLOCKED: exact source HEAD required');
 const text=execFileSync('git',['--no-replace-objects','-c','core.fsmonitor=false','ls-tree','-rz',sourceHead,'--',...requiredInputs],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const entries=text.split('\0').filter(Boolean).map(row=>{const match=row.match(/^(\d+) (\w+) [a-f0-9]+\t(.+)$/);if(!match)throw Error('Build inputs BLOCKED: malformed tree');return{mode:match[1],type:match[2],oid:match[3],path:match[4]};});return validateBuildEntries(entries);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==3)throw Error('Exact source HEAD required');verifyCommittedBuildInputs(process.argv[2]);console.log('BUILD_INPUTS_COMMITTED_REGULAR');}catch(e){console.error(e.message);process.exitCode=2;}
}
