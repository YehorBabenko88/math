import {readFile,stat,lstat,realpath,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {safeJson,freezeJson,sha256} from './json.mjs';
const MAX_PDF=32*1024*1024;
const text=(value,label,max=256)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Invalid '+label);return value.trim()};
function checkScope(scope,pageCount){
 scope=safeJson(scope);if(scope.allowLocalProcessing!==true||typeof scope.allowExternalProcessing!=='boolean'||typeof scope.allowExcerpts!=='boolean'||!Number.isInteger(scope.maxExcerptChars)||scope.maxExcerptChars<0||scope.maxExcerptChars>2000||!scope.allowExcerpts&&scope.maxExcerptChars!==0||!Array.isArray(scope.pages)||!scope.pages.length||scope.pages.length>1000||new Set(scope.pages).size!==scope.pages.length||scope.pages.some(p=>!Number.isInteger(p)||p<1||p>pageCount))throw Error('Invalid or denied processing scope');return scope;
}
async function bytesAt(path){
 if(typeof path!=='string'||path.length>2048||path.includes('\0')||/^\w+:\/\//.test(path))throw Error('Local PDF path required');
 const absolute=resolve(path),info=await lstat(absolute);
 if(!info.isFile()||info.size<8||info.size>MAX_PDF)throw Error('Invalid PDF file or size');
 // String inequality is not a link test on Windows: ADMINI~1 and Administrator
 // may identify the same ordinary directory. Inspect every ancestor instead.
 for(let current=absolute;;){if((await lstat(current)).isSymbolicLink())throw Error('Invalid PDF linked path');const parent=dirname(current);if(parent===current)break;current=parent;}
 const actual=await realpath(absolute);
 const bytes=await readFile(actual);if(bytes.length>MAX_PDF||!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('Invalid PDF header');return {path:actual,bytes};
}
export function assessTextQuality(value,method='text'){
 if(typeof value!=='string'||value.length>100000||!['text','ocr','visual'].includes(method))throw Error('Invalid extracted text');
 const length=value.trim().length,bad=(value.match(/[\uFFFD\u0000-\u0008\u000b\u000c\u000e-\u001f]/g)??[]).length;
 const score=length<40?0.3:Math.max(0,1-bad/Math.max(1,length)*10);
 return {score,method,needsVisualReview:method!=='text'||length<40||score<0.8};
}
export async function intakePdf({path,edition,version,license,scope,parser}={}){
 edition=text(edition,'edition');version=text(version,'source version',128);license=text(license,'license');scope=checkScope(scope,10000);
 if(typeof parser?.inspect!=='function')throw Error('Trusted local PDF parser required');
 const input=await bytesAt(path),hash=sha256(input.bytes),result=safeJson(await parser.inspect(Buffer.from(input.bytes)));
 if(sha256((await bytesAt(input.path)).bytes)!==hash)throw Error('Source hash changed during intake');
 if(!Number.isInteger(result.pageCount)||result.pageCount<1||result.pageCount>10000)throw Error('Unreadable PDF page count');
 return freezeJson({path:input.path,hash,edition,version,license,pageCount:result.pageCount,scope:checkScope(scope,result.pageCount)});
}
export async function extractPdfPage(input,page,{parser,extractionVersion,includeExcerpt=false,render=false,region=null,printedPage=null}={}){
 const book=safeJson(input);const scope=checkScope(book.scope,book.pageCount);
 if(!Number.isInteger(page)||!scope.pages.includes(page))throw Error('Page outside allowed scope');
 if(includeExcerpt&&(!scope.allowExcerpts||scope.maxExcerptChars===0))throw Error('Unauthorized excerpt');
 if(printedPage!==null)text(printedPage,'printed page',128);
 if(region!==null){region=safeJson(region);if(!Array.isArray(region)||region.length!==4||region.some(n=>!Number.isFinite(n)||n<0||n>1)||region[2]<=0||region[3]<=0||region[0]+region[2]>1||region[1]+region[3]>1)throw Error('Invalid formula region')}
 text(extractionVersion,'extraction version',128);if(typeof parser?.extract!=='function')throw Error('Trusted local parser required');
 const file=await bytesAt(book.path);if(sha256(file.bytes)!==book.hash)throw Error('Source hash mismatch');
 const parsed=safeJson(await parser.extract(Buffer.from(file.bytes),{page,render:render||region!==null,region}),{maxBytes:6_000_000});
 if(sha256((await bytesAt(book.path)).bytes)!==book.hash)throw Error('Source hash changed during extraction');
 const quality=assessTextQuality(parsed.text,parsed.method);if(parsed.rasterPresent===true||region!==null)quality.needsVisualReview=true;
 if(!Array.isArray(parsed.regions)||parsed.regions.length>200||!Array.isArray(parsed.references)||parsed.references.length>100)throw Error('Invalid page regions');
 for(const region of parsed.regions){if(!['text','table','figure'].includes(region.kind)||!Array.isArray(region.bounds)||region.bounds.length!==4||region.bounds.some(n=>!Number.isFinite(n)||n<0||n>1)||region.bounds[2]<=0||region.bounds[3]<=0||region.bounds[0]+region.bounds[2]>1.000001||region.bounds[1]+region.bounds[3]>1.000001)throw Error('Invalid page bounds')}
 for(const ref of parsed.references)if(!['table','figure'].includes(ref.kind)||typeof ref.label!=='string'||ref.label.length>80)throw Error('Invalid page reference');
 if(parsed.image!==null&&(typeof parsed.image!=='string'||parsed.image.length>5_000_000||!/^iVBOR[A-Za-z0-9+/=]*$/.test(parsed.image)))throw Error('Invalid PNG page image');
 return freezeJson({source:{hash64hex:book.hash,edition:book.edition,version:book.version,license:book.license},locator:{pdfPage1based:page,printedPage,region},extractionVersion,text:parsed.text,textHash:sha256(parsed.text),textScope:region?'whole-page-context-with-focused-image':'whole-page',quality,regions:parsed.regions,references:parsed.references,image:parsed.image,...(includeExcerpt?{excerpt:parsed.text.slice(0,scope.maxExcerptChars)}:{})});
}
export function createLocalPdfParser({pythonPath,timeoutMs=15000,maxOutputBytes=6_000_000}={}){
 if(typeof pythonPath!=='string'||!pythonPath||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000||!Number.isInteger(maxOutputBytes)||maxOutputBytes<1000||maxOutputBytes>8_000_000)throw Error('Invalid parser configuration');
 const script=fileURLToPath(new URL('../../scripts/book-ingestion-pdf.py',import.meta.url));
 async function run(bytes,options){
  if(!Buffer.isBuffer(bytes)||bytes.length>MAX_PDF)throw Error('Invalid PDF bytes');
  if(options!==undefined){
   options=safeJson(options);
   const region=options.region;
   if(!Number.isInteger(options.page)||options.page<1||options.page>10000||options.render!==undefined&&typeof options.render!=='boolean'||region!==undefined&&region!==null&&(!Array.isArray(region)||region.length!==4||region.some(n=>!Number.isFinite(n)||n<0||n>1)||region[2]<=0||region[3]<=0||region[0]+region[2]>1||region[1]+region[3]>1))throw Error('Invalid PDF parser options');
   if(region)options.render=true;
  }
  const dir=await mkdtemp(join(tmpdir(),'math-book-parser-'));
  try{
   const path=join(dir,'source.pdf');await writeFile(path,bytes,{mode:0o600});
   const args=[script,'--input',path,...(options?['--page',String(options.page),...(options.render?['--render']:[]),...(options.region?['--region',JSON.stringify(options.region)]:[])]:[])];
   return await new Promise((accept,reject)=>{
    const env=Object.fromEntries(['PATH','SystemRoot','WINDIR','TEMP','TMP'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));env.PYTHONUTF8='1';env.PYTHONNOUSERSITE='1';
    const child=spawn(pythonPath,args,{cwd:dir,env,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
    let size=0,done=false,failure;const chunks=[];
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);error?reject(Error(error)):accept(value)};
    const timer=setTimeout(()=>{failure='PDF parser timeout';child.kill('SIGKILL')},timeoutMs);
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>maxOutputBytes){failure='PDF parser output limit';child.kill('SIGKILL')}else chunks.push(chunk)});
    child.stderr.on('data',()=>{});child.on('error',()=>finish('PDF parser unavailable'));
    child.on('close',code=>{if(failure)return finish(failure);if(code!==0)return finish('PDF parser rejected input');try{finish(null,safeJson(Buffer.concat(chunks).toString('utf8'),{maxBytes:maxOutputBytes}))}catch{finish('Invalid PDF parser response')}});
   });
  }finally{await rm(dir,{recursive:true,force:true})}
 }
 return Object.freeze({inspect:bytes=>run(bytes),extract:(bytes,options)=>run(bytes,options)});
}
