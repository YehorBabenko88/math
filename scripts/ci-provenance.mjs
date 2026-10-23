import {validateProvenanceMetadata,verifySourceIdentity,verifyTestedSourceIdentity} from './verify-source-identity.mjs';
import {verifyCommittedDependencies} from './verify-dependency-locks.mjs';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function createProvenance(env=process.env){
 const metadata=validateProvenanceMetadata(env);
 const sourceSha=execFileSync('git',['--no-replace-objects','rev-parse','HEAD'],{encoding:'utf8'}).trim();
 if(sourceSha!==env.GITHUB_SHA)throw Error('Checkout differs from workflow source SHA');
 let lockSha256=null,evidence={},committed;
 try{committed=execFileSync('git',['--no-replace-objects','show',sourceSha+':package-lock.json'],{stdio:['ignore','pipe','ignore']});}catch(error){if(error.status!==128)throw error;}
 if(committed){
  if(!committed.equals(readFileSync('package-lock.json')))throw Error('Lock bytes differ');
  evidence=verifyCommittedDependencies({sourceSha});lockSha256=evidence.lockSha256;
  const gitBlob=path=>execFileSync('git',['--no-replace-objects','show',sourceSha+':'+path],{stdio:['ignore','pipe','pipe']});
  assert.deepEqual(JSON.parse(readFileSync('package.json')),JSON.parse(gitBlob('package.json')),'Package manifest differs from committed source');
  const eol=b=>b.toString('utf8').replaceAll('\r\n','\n');
  if(eol(readFileSync('scripts/book-ingestion-requirements.txt'))!==eol(gitBlob('scripts/book-ingestion-requirements.txt')))throw Error('Python requirements differ from committed source');
 }

 const sourceIdentity=committed?verifyTestedSourceIdentity(env):verifySourceIdentity(sourceSha);
 return {schema:1,...evidence,...sourceIdentity,sourceSha,lockSha256,qualified:lockSha256!==null,...metadata};
}
if(process.argv[1]?.endsWith('ci-provenance.mjs'))writeFileSync('release-provenance.json',JSON.stringify(createProvenance())+'\n');
