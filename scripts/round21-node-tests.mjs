import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {verifyCurrentSourceFiles} from './platform-source-transfer.mjs';
verifyCurrentSourceFiles();
const live=process.argv.includes('--live');
if(live&&(!process.env.MATH_EXPERIMENT_OWNER_URL||!process.env.MATH_EXPERIMENT_HOST_URL))throw Error('EXPLICIT_ISOLATED_POSTGRES_REQUIRED');
const proof=JSON.parse(readFileSync('scripts/platform-round21-source-extension.json','utf8'));
// External Grid/Terminan pins belong to the separately invoked chain fixture.
const files=Object.keys(proof.files).filter(x=>(live||x!=='tests/experiment-postgres-live.test.mjs')&&x!=='tests/round21-chain-live.test.mjs');
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit',windowsHide:true,shell:false});
process.exit(result.status??1);
