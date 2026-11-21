import {extractPdfPage} from './pdf.mjs';
import {verifyPageCandidate} from './codex.mjs';
import {safeJson,canonicalJSON} from './json.mjs';
export async function enqueueBookPages(queue,input,{extractionVersion,render=false,locatorOverrides={}}={}){
 const book=safeJson(input);if(typeof extractionVersion!=='string'||!extractionVersion.trim()||extractionVersion.length>100||typeof render!=='boolean')throw Error('Invalid extraction policy');
 const jobs=[];for(const page of book.scope.pages){
  const locator=safeJson(locatorOverrides)[page]??{region:null,printedPage:null};if(Object.keys(locator).some(k=>!['region','printedPage'].includes(k)))throw Error('Invalid locator override');
  const job=await queue.enqueue({sourceHash:book.hash,edition:book.edition,page,extractionVersion,payload:{book,render,locator}});
  const saved=job.payload.book;if(saved.version!==book.version||saved.license!==book.license||saved.pageCount!==book.pageCount||job.payload.render!==render||canonicalJSON(saved.scope)!==canonicalJSON(book.scope)||canonicalJSON(job.payload.locator)!==canonicalJSON(locator))throw Error('Conflicting intake scope or version');jobs.push(job);
 }return jobs;
}
export async function runBookJob({queue,parser,adapter,workerId,leaseMs=60000,jobId}={}){
 const job=await queue.acquire({workerId,leaseMs,...(jobId!==undefined?{jobId}:{})});if(!job)return null;
 const metrics={pagesAttempted:0,extractionFailures:0,aiSuggestions:0,reviewDecisions:0,cost:0};
 let phase='extract',completedCall=false;
 try{
  if(job.checkpoint!==undefined){
   const checkpoint=safeJson(job.checkpoint),saved=checkpoint.metrics;
   if(Object.keys(checkpoint).some(k=>!['metrics','candidate','cost'].includes(k))||saved===null||typeof saved!=='object'||Array.isArray(saved)||Object.entries(saved).some(([k,v])=>!['pagesAttempted','extractionFailures','aiSuggestions','reviewDecisions','cost','adapterAttempts','costUnknown'].includes(k)||!Number.isFinite(v)||v<0)||checkpoint.cost!==undefined&&(!Number.isFinite(checkpoint.cost)||checkpoint.cost<0))throw Error('Invalid worker checkpoint');
   Object.assign(metrics,saved);
  }
  const {book,render,locator={}}=safeJson(job.payload);if(book.hash!==job.sourceHash||book.edition!==job.edition)throw Error('Job source pin mismatch');
  if(typeof render!=='boolean'||!locator||typeof locator!=='object'||Array.isArray(locator)||Object.keys(locator).some(k=>!['region','printedPage'].includes(k)))throw Error('Invalid stored extraction policy');
  metrics.pagesAttempted++;
  const page=await extractPdfPage(book,job.page,{parser,extractionVersion:job.extractionVersion,render,region:locator.region??null,printedPage:locator.printedPage??null});
  phase='codex';let result;
  if(job.checkpoint?.candidate){const verified=verifyPageCandidate(job.checkpoint.candidate,{page,book});result={...verified,cost:job.checkpoint.cost??0}}
  else{
   metrics.adapterAttempts=(metrics.adapterAttempts??0)+1;
   await queue.checkpoint(job.id,job.token,{metrics});
   const response=safeJson(await adapter.extract(page,{book,requestId:job.id}));
   if(!Number.isFinite(response.cost)||response.cost<0)throw Error('Invalid adapter cost');
   metrics.cost+=response.cost;
   result={...verifyPageCandidate(response.candidate,{page,book}),cost:response.cost};
   metrics.aiSuggestions=result.candidate.concepts.length+result.candidate.formulas.length+result.candidate.claims.length;
   await queue.checkpoint(job.id,job.token,{candidate:result.candidate,cost:result.cost,metrics});
  }
  phase='complete';completedCall=true;
  return await queue.complete(job.id,job.token,{result:{stage:'review_required',candidate:result.candidate,digest:result.digest,report:result.report},metrics});
 }catch(error){
  if(Number.isFinite(error?.actualCost)&&error.actualCost>=0)metrics.cost+=error.actualCost;
  if(adapter?.kind==='external'&&error?.code==='ADAPTER_UNAVAILABLE')metrics.costUnknown=(metrics.costUnknown??0)+1;
  if(phase==='extract')metrics.extractionFailures++;
  try{
   if(!job.checkpoint?.candidate&&!completedCall)await queue.checkpoint(job.id,job.token,{metrics});
   return await queue.fail(job.id,job.token,{code:'INGESTION_REJECTED',retryable:completedCall||error?.code==='ADAPTER_UNAVAILABLE'});
  }catch{return {id:job.id,state:'lease_lost',errorCode:'LEASE_LOST'}}
 }
}
