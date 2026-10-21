import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute,dirname,sep,basename,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const contexts={
 '.github/workflows/ci.yml':['test'],
 '.github/workflows/book-ingestion.yml':['native-pdf'],
 '.github/workflows/browser.yml':['chromium'],
 '.github/workflows/postgres-integration.yml':['Full suite Node 22 / PostgreSQL 16','Full suite Node 22 / PostgreSQL 18','Full suite Node 24 / PostgreSQL 16','Full suite Node 24 / PostgreSQL 18'],
 '.github/workflows/windows-deployment.yml':['Windows contracts / powershell','Windows contracts / pwsh']
};
export function validateProvenanceMetadata(env){
 for(const key of ['GITHUB_SHA','GITHUB_REPOSITORY','GITHUB_WORKFLOW_REF','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','PROVENANCE_CONTEXT'])if(typeof env[key]!=='string'||/[\u0000-\u001f\u007f]/.test(env[key]))throw Error('Invalid provenance metadata: '+key);
 if(env.GITHUB_REPOSITORY!=='YehorBabenko88/math')throw Error('Invalid provenance repository metadata');
 if(!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''))throw Error('Invalid provenance source SHA metadata');
 for(const key of ['GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT'])if(!/^[1-9][0-9]*$/.test(env[key]??'')||BigInt(env[key])>9223372036854775807n)throw Error('Invalid provenance run/attempt metadata');
 const prefix=env.GITHUB_REPOSITORY+'/',ref=env.GITHUB_WORKFLOW_REF;
 if(typeof ref!=='string'||!ref.startsWith(prefix))throw Error('Invalid provenance workflow metadata');
 const match=ref.slice(prefix.length).match(/^(\.github\/workflows\/[a-z-]+\.yml)@(refs\/(?:heads|tags)\/[A-Za-z0-9_./-]+|refs\/pull\/[1-9][0-9]*\/merge)$/);
 if(!match||!contexts[match[1]]||match[2].includes('..')||match[2].includes('//')||match[2].endsWith('/'))throw Error('Invalid provenance workflow metadata');
 if(!contexts[match[1]].includes(env.PROVENANCE_CONTEXT))throw Error('Invalid provenance job context');
 return {repository:env.GITHUB_REPOSITORY,workflowPath:match[1],runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT,context:env.PROVENANCE_CONTEXT};
}
const digest=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',['--no-replace-objects','-c','core.fsmonitor=false',...args],{stdio:['ignore','pipe','pipe']});
function noSymlink(path){
 let item=resolve(path);
 while(true){if(lstatSync(item).isSymbolicLink())throw Error('Source path symlink is not allowed');const parent=dirname(item);if(parent===item)break;item=parent;}
}
export function verifySourceIdentity(sourceSha){
 if(!/^[a-f0-9]{40}$/.test(sourceSha??''))throw Error('Invalid source SHA');
 const root=git('rev-parse','--show-toplevel').toString('utf8').trim();noSymlink(root);
 if((process.platform==='win32'?realpathSync.native(process.cwd()).toLowerCase():realpathSync.native(process.cwd()))!==(process.platform==='win32'?realpathSync.native(root).toLowerCase():realpathSync.native(root)))throw Error('Source identity requires repository root: '+JSON.stringify({cwd:realpathSync.native(process.cwd()),root:realpathSync.native(root)}));
 if(git('rev-parse','HEAD').toString().trim()!==sourceSha)throw Error('Checkout differs from workflow source SHA');
 if(git('diff-index','--cached','--name-only',sourceSha,'--').length)throw Error('Source index differs from committed source');
 const entries=git('ls-tree','-rz','--full-tree',sourceSha).toString('utf8').split('\0').filter(Boolean);
 const autocrlf=git('config','--default','false','--get','core.autocrlf').toString().trim();
 const files=[];
 for(const entry of entries){
  const match=entry.match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/s);
  if(!match)throw Error('Unsupported tracked source mode (symlink or gitlink)');
  const [,mode,blob,path]=match;
  if(path.split('/').some(p=>!p||p==='..'||p==='.')||path.includes('\\'))throw Error('Invalid tracked source path');
  const full=resolve(root,path);noSymlink(full);if(!lstatSync(full).isFile())throw Error('Tracked source is not a regular file');
  let bytes=readFileSync(full);
  const blobHash=b=>createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
  if(blobHash(bytes)!==blob){
   const attr=git('check-attr',`--source=${sourceSha}`,'-z','text','eol','--',path).toString().split('\0');
   const text=attr[2],eol=attr[5];
   if(text==='unset'||eol==='lf'||!(eol==='crlf'||autocrlf==='true')||bytes.includes(0))throw Error('Tracked source bytes differ: '+path);
   let decoded;try{decoded=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw Error('Tracked source bytes differ: '+path);}
   if(/(?<!\r)\n|\r(?!\n)/.test(decoded))throw Error('Noncanonical tracked source EOL: '+path);
   bytes=Buffer.from(decoded.replaceAll('\r\n','\n'));
   if(blobHash(bytes)!==blob)throw Error('Tracked source bytes differ: '+path);
  }
  files.push({path,mode,blob});
 }
 return {sourceSha,committedTreeSha:git('rev-parse',`${sourceSha}^{tree}`).toString().trim(),trackedSourceSha256:digest(JSON.stringify(files)),trackedFiles:files.length};
}
function receiptPath(env){
 if(!env.SOURCE_IDENTITY_RECEIPT||!isAbsolute(env.SOURCE_IDENTITY_RECEIPT))throw Error('Absolute source identity receipt path required');
 const requested=resolve(env.SOURCE_IDENTITY_RECEIPT);noSymlink(dirname(requested));
 const path=join(realpathSync.native(dirname(requested)),basename(requested)),root=realpathSync.native(git('rev-parse','--show-toplevel').toString().trim());
 const rel=relative(root,path);if(rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel))throw Error('Source identity receipt must be outside checkout');
 noSymlink(dirname(path));return path;
}
export function captureSourceIdentity(env=process.env){
 const metadata=validateProvenanceMetadata(env),identity=verifySourceIdentity(env.GITHUB_SHA);
 const receipt={schema:1,...metadata,...identity};
 writeFileSync(receiptPath(env),JSON.stringify(receipt)+'\n',{flag:'wx',mode:0o600});return receipt;
}
export function verifyTestedSourceIdentity(env=process.env){
 const metadata=validateProvenanceMetadata(env),identity=verifySourceIdentity(env.GITHUB_SHA),path=receiptPath(env);noSymlink(path);
 const before=JSON.parse(readFileSync(path,'utf8'));
 if(JSON.stringify(before)!==JSON.stringify({schema:1,...metadata,...identity}))throw Error('Pre/post tested source identity mismatch');
 return {...identity,testedWorktreeVerified:true,sourceEvidence:'self-reported-pre-post-tracked-tree/v1'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{if(process.argv[2]!=='--before')throw Error('Expected --before');console.log(JSON.stringify(captureSourceIdentity()));}catch(error){console.error(error.message);process.exitCode=1;}
}
