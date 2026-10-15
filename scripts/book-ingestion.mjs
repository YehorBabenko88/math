import {readFile,open,lstat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {intakePdf,createLocalPdfParser,extractPdfPage} from '../src/book-ingestion/pdf.mjs';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';
import {makeCodexBookTask,createLocalCodexAdapter} from '../src/book-ingestion/codex.mjs';
import {enqueueBookPages,runBookJob} from '../src/book-ingestion/worker.mjs';
async function boundedFile(path,max){const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||info.size>max)throw Error('Invalid local input');const bytes=await readFile(path);if(bytes.length>max)throw Error('Input too large');return bytes.toString('utf8')}
async function exclusive(path,data){const handle=await open(path,'wx',0o600);try{await handle.writeFile(data);await handle.sync()}finally{await handle.close()}}
export async function runBookIngestion(args,{stdout=process.stdout}={}){
 const [command,...rest]=args,options={},allowed=['--queue','--pdf','--edition','--version','--license','--scope','--python','--extraction-version','--job','--output','--response','--worker'];
 if(!['enqueue','list','task','run-one','backup','restore'].includes(command))throw Error('Unknown command');
 for(let i=0;i<rest.length;i+=2){const key=rest[i];if(!allowed.includes(key)||options[key]!==undefined||!rest[i+1]||rest[i+1].startsWith('--'))throw Error('Invalid options');options[key]=rest[i+1]}
 const required=keys=>{for(const k of keys)if(!options[k])throw Error('Required options missing')};required(['--queue']);
 const queue=await openBookQueue({directory:options['--queue']});let summary;
 if(command==='enqueue'){
  required(['--pdf','--edition','--version','--license','--scope','--python','--extraction-version']);
  const parser=createLocalPdfParser({pythonPath:options['--python']});
  const book=await intakePdf({path:options['--pdf'],edition:options['--edition'],version:options['--version'],license:options['--license'],scope:JSON.parse(await boundedFile(options['--scope'],16384)),parser});
  const jobs=await enqueueBookPages(queue,book,{extractionVersion:options['--extraction-version']});summary={sourceHash:book.hash,pageCount:book.pageCount,jobs:jobs.map(j=>({id:j.id,state:j.state}))};
 }else if(command==='task'){
  required(['--job','--output','--python']);const job=await queue.get(options['--job']);if(!job)throw Error('Unknown job');
  const page=await extractPdfPage(job.payload.book,job.page,{parser:createLocalPdfParser({pythonPath:options['--python']}),extractionVersion:job.extractionVersion,render:true,...job.payload.locator});
  await exclusive(options['--output'],JSON.stringify(makeCodexBookTask(page,{requestId:job.id}))+'\n');summary={id:job.id,taskWritten:true};
 }else if(command==='run-one'){
  required(['--python','--response','--worker','--job']);const response=await boundedFile(options['--response'],256000);
  const result=await runBookJob({queue,parser:createLocalPdfParser({pythonPath:options['--python']}),adapter:createLocalCodexAdapter({extract:()=>response}),workerId:options['--worker'],jobId:options['--job']});
  summary=result?{id:result.id,state:result.state,metrics:result.metrics??null}:null;
 }else if(command==='backup'){required(['--output']);await exclusive(options['--output'],JSON.stringify(await queue.exportSnapshot())+'\n');summary={backupWritten:true}}
 else if(command==='restore'){required(['--response']);await queue.importSnapshot(await boundedFile(options['--response'],8*1024*1024));summary={restored:true}}
 else summary=(await queue.list()).map(j=>({id:j.id,state:j.state,page:j.page,attempts:j.attempts,metrics:j.metrics??j.checkpoint?.metrics??null}));
 stdout.write(JSON.stringify(summary)+'\n');return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)runBookIngestion(process.argv.slice(2)).catch(()=>{process.stderr.write('Book ingestion command failed; inspect configuration and local input permissions.\n');process.exitCode=1});
