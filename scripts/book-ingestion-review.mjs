import {open,lstat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {verifyCandidate} from '../src/book-ingestion/candidate.mjs';
import {createReviewDecision} from '../src/book-ingestion/review.mjs';
import {canonicalJSON,sha256} from '../src/book-ingestion/json.mjs';

// Read-only unless explicit human decision fields and an exclusive output path are supplied.
export async function runBookReview(args,{stdout=process.stdout}={}){
 const values={};const options=new Set(['--candidate','--decision','--reviewer','--reason','--output','--queue','--job']);
 for(let i=0;i<args.length;i++){
  const key=args[i];if(key==='--visual-verified'){if(values[key]!==undefined)throw Error('Duplicate option');values[key]=true;continue}
  if(!options.has(key)||values[key]!==undefined||!args[i+1]||args[i+1].startsWith('--'))throw Error('Invalid command options');values[key]=args[++i];
 }
 if(!values['--candidate'])throw Error('Candidate path required');
 if((values['--queue']!==undefined)!==(values['--job']!==undefined))throw Error('Queue and job options require a pair');
 if(values['--queue']!==undefined&&values['--decision']===undefined)throw Error('Decision required for queue recording');
 if(values['--job']!==undefined&&!/^[a-f0-9]{64}$/.test(values['--job']))throw Error('Invalid queue job identifier');
 const stat=await lstat(values['--candidate']);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>256000)throw Error('Invalid local candidate file');
 const candidateFile=await open(values['--candidate'],'r');let candidate;
 try{
  const current=await candidateFile.stat();if(!current.isFile()||current.size>256000)throw Error('Invalid local candidate file');
  const buffer=Buffer.alloc(256001);let total=0;
  while(total<buffer.length){const {bytesRead}=await candidateFile.read(buffer,total,buffer.length-total,null);if(!bytesRead)break;total+=bytesRead}
  if(total>256000)throw Error('Candidate file too large');candidate=new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,total));
 }finally{await candidateFile.close()}
 const verified=verifyCandidate(candidate);
 const summary={candidateDigest:verified.digest,sourceHash:verified.candidate.source.hash64hex,sourcePinHash:sha256(canonicalJSON({source:verified.candidate.source,extractionVersion:verified.candidate.extraction.version})),page:verified.candidate.locator.pdfPage1based,status:verified.report.status,requiresVisualReview:verified.report.requiresVisualReview,scope:verified.report.scope,counts:{concepts:verified.candidate.concepts.length,formulas:verified.candidate.formulas.length,claims:verified.candidate.claims.length,evidence:verified.candidate.evidence.length,numericExamples:verified.report.examples.length}};
 if(values['--decision']===undefined){if(['--reviewer','--reason','--output','--visual-verified'].some(k=>values[k]!==undefined))throw Error('Decision required for review output')}
 else{
  if(!values['--output']||!values['--reviewer']||!values['--reason'])throw Error('Explicit reviewer reason and output required');
  const receipt=createReviewDecision(candidate,{decision:values['--decision'],reviewer:values['--reviewer'],reason:values['--reason'],reviewedAt:new Date().toISOString(),visualVerified:values['--visual-verified']===true});
  let queue;
  if(values['--queue']!==undefined){
   const directory=await lstat(values['--queue']);if(!directory.isDirectory()||directory.isSymbolicLink())throw Error('Existing queue directory required');
   const database=await lstat(join(values['--queue'],'queue.sqlite'));if(!database.isFile()||database.isSymbolicLink())throw Error('Existing queue database required');
   const {openBookQueue}=await import('../src/book-ingestion/queue.mjs');
   queue=await openBookQueue({directory:values['--queue']});const job=await queue.get(values['--job']);
   if(!job||job.state!=='completed'||job.result?.digest!==receipt.candidateDigest)throw Error('Completed queue job candidate digest mismatch');
  }
  const file=await open(values['--output'],'wx',0o600);
  try{await file.writeFile(JSON.stringify(receipt)+'\n','utf8');await file.sync()}finally{await file.close()}
  if(queue){await queue.recordReview(values['--job'],receipt);summary.queueReviewRecorded=true}
  summary.decision=receipt.decision;summary.receiptWritten=true;
 }
 stdout.write(JSON.stringify(summary)+'\n');return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)runBookReview(process.argv.slice(2)).catch(()=>{process.stderr.write('Book review failed; no graph changes requested. Check candidate, review fields and exclusive output path.\n');process.exitCode=1});
