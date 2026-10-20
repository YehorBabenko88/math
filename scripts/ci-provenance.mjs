import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function createProvenance(env=process.env){
 const sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 if(sourceSha!==env.GITHUB_SHA)throw Error('Checkout differs from workflow source SHA');
 let lockSha256=null;
 try {const committed=execFileSync('git',['show',sourceSha+':package-lock.json'],{stdio:['ignore','pipe','ignore']});const disk=readFileSync('package-lock.json');if(!committed.equals(disk))throw Error('Lock bytes differ');lockSha256=sha256(committed);}catch(error){if(error.status!==128)throw error;}
 return {schema:1,sourceSha,lockSha256,qualified:lockSha256!==null,repository:env.GITHUB_REPOSITORY,workflowPath:env.GITHUB_WORKFLOW_REF?.split('@')[0].replace(env.GITHUB_REPOSITORY+'/',''),runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT,context:env.PROVENANCE_CONTEXT};
}
if(process.argv[1]?.endsWith('ci-provenance.mjs'))writeFileSync('release-provenance.json',JSON.stringify(createProvenance())+'\n');
