import{readFileSync,lstatSync,realpathSync,openSync,fstatSync,readSync,closeSync,constants,mkdtempSync,mkdirSync,writeFileSync}from'node:fs';
import{resolve,dirname,join}from'node:path';import{tmpdir}from'node:os';import{createHash}from'node:crypto';import{pathToFileURL}from'node:url';
const pin='878c4d0910977c742d25193b35b5c678ab6dbe7b';
const need=x=>{if(!x)throw Error('ROOT_UNIT_SOURCE_REFUSED');};
function ordinary(path){for(let p=path;;p=dirname(p)){const s=lstatSync(p);need(s.isDirectory()&&!s.isSymbolicLink());if(dirname(p)===p)break;}}
function rawOwned(path){const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const a=fstatSync(fd,{bigint:true});need(a.isFile()&&a.nlink===1n&&a.size>0n&&a.size<=131072n);const data=Buffer.alloc(Number(a.size)+1),count=readSync(fd,data,0,data.length,0);const b=fstatSync(fd,{bigint:true}),n=lstatSync(path,{bigint:true});need(count===Number(a.size)&&n.isFile()&&!n.isSymbolicLink()&&b.nlink===1n&&n.nlink===1n&&['dev','ino','size','mtimeNs','ctimeNs'].every(k=>a[k]===b[k]&&b[k]===n[k]));return data.subarray(0,count);}finally{closeSync(fd);}}
/** No injected fetcher: hosted run always invokes Root-owned fixed API/ZIP custody. */
export async function collectRootUnits(context){
 try{
  need(process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_ENVIRONMENT==='github-hosted'&&process.env.GITHUB_REPOSITORY==='YehorBabenko88/math'&&process.env.ROOT_MATRIX_RESULT==='success');
  for(const key of ['NODE_OPTIONS','NODE_PATH','NODE_DEBUG','NODE_DEBUG_NATIVE','ACTIONS_ID_TOKEN_REQUEST_TOKEN','ACTIONS_ID_TOKEN_REQUEST_URL'])need(!process.env[key]);
  need(Number.isInteger(constants.O_NOFOLLOW)&&constants.O_NOFOLLOW>0);
  const root=resolve(process.env.ROOT_UNIT_CHECKOUT);need(root===process.env.ROOT_UNIT_CHECKOUT&&root.endsWith('/root')&&/^[.]root-unit-source-[A-Za-z0-9]{6}$/.test(dirname(root).split('/').at(-1))&&dirname(dirname(root))===realpathSync(process.env.GITHUB_WORKSPACE));ordinary(root);need((lstatSync(dirname(root)).mode&0o077)===0);ordinary(join(root,'.git'));need(rawOwned(join(root,'.git/HEAD')).equals(Buffer.from(pin+'\n')));
  const manifest=JSON.parse(readFileSync(new URL('./root-unit-source.json',import.meta.url)));need(manifest.commit===pin&&manifest.repository==='YehorBabenko88/unified-system'&&Object.keys(manifest.files).length===10);
  const temporary=realpathSync(tmpdir());ordinary(temporary);const isolated=mkdtempSync(join(temporary,'math-root-unit-custody-'));need((lstatSync(isolated).mode&0o077)===0);
  for(const[path,hash]of Object.entries(manifest.files)){need(/^[A-Za-z0-9_./-]+$/.test(path)&&!path.includes('..')&&/^[a-f0-9]{64}$/.test(hash));ordinary(dirname(join(root,path)));const raw=rawOwned(join(root,path));need(createHash('sha256').update(raw).digest('hex')===hash);const target=join(isolated,path);mkdirSync(dirname(target),{recursive:true,mode:0o700});writeFileSync(target,raw,{flag:'wx',mode:0o600});}
  const module=await import(pathToFileURL(join(isolated,'tools/ci_evidence_role_matrix/artifact_custody.mjs')).href);
  const expected={event:context.event,ref:process.env.GITHUB_REF,runnerSource:pin,runId:context.runId,attempt:context.attempt,prNumber:context.event==='pull_request'?process.env.ROOT_PR_NUMBER:null,workloadHead:context.workloadHead};
  return await module.collectRootRoleCoverage(JSON.stringify(expected),{token:process.env.ROOT_UNIT_API_TOKEN});
 }catch{return{status:'HELD',coverage:'HELD',code:'E_MATH_ROOT_UNIT_CUSTODY',authority:'NONE',source_authentication:'NOT_EVALUATED',native_acceptance:'NOT_QUALIFIED',production:'NO_GO'};}
}
