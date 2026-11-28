import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyCurrentSourceFiles} from './platform-source-transfer.mjs';
verifyCurrentSourceFiles();
const live=process.argv.includes('--live');
if(live&&(!process.env.MATH_EXPERIMENT_OWNER_URL||!process.env.MATH_EXPERIMENT_HOST_URL))throw Error('EXPLICIT_ISOLATED_POSTGRES_REQUIRED');
const proof=JSON.parse(readFileSync('scripts/platform-round21-source-extension.json','utf8'));
// External Grid/Terminan pins belong to the separately invoked chain fixture.
// U's originally published test-only filename has no auto-discovery suffix.
// Keep its exact owner bytes/path; never rename, weaken, or silently drop it.
const uTrust='tests/test_u_r25_trust.mjs';
const uExpected='07ac17692a3b632bbf0070498abe5d79152fedbe6a7e3520de6b200789861016';
if(createHash('sha256').update(readFileSync(uTrust)).digest('hex')!==uExpected)throw Error('X11_U_TRUST_BYTES_CHANGED');
const files=[...Object.keys(proof.files).filter(x=>(live||x!=='tests/experiment-postgres-live.test.mjs')&&x!=='tests/round21-chain-live.test.mjs'),uTrust];
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit',windowsHide:true,shell:false});
process.exit(result.status??1);
