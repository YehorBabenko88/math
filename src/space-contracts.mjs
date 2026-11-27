// Source-only structural contract. No authority or numerical kernel.
import {snapshotJSON} from './scientific-data.mjs';
const fail=(code='INVALID_SCHEMA')=>{throw new Error(code)};
const check=(ok,code)=>{if(!ok)fail(code)};
const obj=(v,keys)=>check(v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)));
const fields=s=>s.split(' ');
const id=v=>check(typeof v==='string'&&/^[!-~]{1,128}$/.test(v));
const hash=v=>check(typeof v==='string'&&/^[a-f0-9]{64}$/.test(v));
const integer=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>check(Number.isSafeInteger(v)&&!Object.is(v,-0)&&v>=min&&v<=max);
const bool=v=>check(typeof v==='boolean');
const one=(v,...options)=>check(options.includes(v));
const arr=(v,min=0,max=2000)=>check(Array.isArray(v)&&v.length>=min&&v.length<=max,'DIMENSION');
const nullable=(v,f)=>{if(v!==null)f(v)};
const unique=v=>check(new Set(v).size===v.length);
const ref=v=>{obj(v,fields('schema kind sha256 byteLength encoding'));one(v.schema,'math.artifact-ref.v1');id(v.kind);hash(v.sha256);integer(v.byteLength);id(v.encoding)};
const bits=v=>{check(typeof v==='string'&&/^[0-9a-f]{16}$/.test(v));check(v!=='8000000000000000'&&!/^[7f]ff/.test(v))};
const nonneg=v=>{bits(v);check(v[0]<'8')};
const axes=v=>{arr(v,1,256);v.forEach(a=>{obj(a,['id','unit']);id(a.id);id(a.unit)});unique(v.map(a=>a.id))};
const closed=(schema,keys,fn)=>input=>{let v;try{v=snapshotJSON(input)}catch{fail()}obj(v,['schema',...fields(keys)]);one(v.schema,schema);fn(v);return v};
export const validateSpaceSpec=closed('math.space.spec.v1','spaceId kind axes numericPolicyRef metric parameters',v=>{
 id(v.spaceId);axes(v.axes);hash(v.numericPolicyRef);obj(v.metric,fields('id version parameters'));id(v.metric.id);id(v.metric.version);check(v.metric.parameters!==null&&typeof v.metric.parameters==='object'&&!Array.isArray(v.metric.parameters));
 const p=v.parameters,d=v.axes.length;
 switch(v.kind){
 case 'euclidean':obj(p,fields('dimension scaling'));check(p.dimension===d,'DIMENSION');one(p.scaling,'none','train-standardize');break;
 case 'sphere':obj(p,fields('ambientDimension intrinsicDimension radius origin retainNorm'));check(d>=2&&p.ambientDimension===d&&p.intrinsicDimension===d-1,'DIMENSION');nonneg(p.radius);check(p.radius!=='0000000000000000');arr(p.origin,d,d);p.origin.forEach(bits);check(p.retainNorm===true);break;
 case 'manifold':obj(p,fields('ambientDimension intrinsicDimension chartId chartVersion domainRef'));check(p.ambientDimension===d,'DIMENSION');integer(p.intrinsicDimension,1,d);id(p.chartId);id(p.chartVersion);ref(p.domainRef);break;
 case 'phase':obj(p,fields('lags cadenceMs gapPolicy baseSpaceRef'));arr(p.lags,1,256);p.lags.forEach(x=>integer(x));unique(p.lags);integer(p.cadenceMs,1);one(p.gapPolicy,'reject','exclude-window');ref(p.baseSpaceRef);break;
 case 'graph':obj(p,fields('directed signed nodeSchemaId edgeSchemaId weightMeaning graphProfileRef'));bool(p.directed);bool(p.signed);id(p.nodeSchemaId);id(p.edgeSchemaId);id(p.weightMeaning);ref(p.graphProfileRef);break;
 case 'distribution':obj(p,fields('supportKind dimension estimatorId estimatorVersion weightPolicy supportRef'));id(p.supportKind);check(p.dimension===d,'DIMENSION');id(p.estimatorId);id(p.estimatorVersion);one(p.weightPolicy,'probability','explicit-normalize');ref(p.supportRef);break;
 default:fail();
 }
});
export const validateSpaceBatch=closed('math.space.batch.v1','source axes shape sampleIds eventEndMs availableAtMs validityMask valuesRef numericPolicyRef',v=>{
 obj(v.source,fields('datasetRef receiptRef revision coverageStatus'));ref(v.source.datasetRef);ref(v.source.receiptRef);id(v.source.revision);id(v.source.coverageStatus);axes(v.axes);arr(v.shape,2,2);const [n,d]=v.shape;integer(n,1,2000);check(d===v.axes.length,'DIMENSION');for(const a of [v.sampleIds,v.eventEndMs,v.availableAtMs,v.validityMask])arr(a,n,n);v.sampleIds.forEach(id);unique(v.sampleIds);
 for(let i=0;i<n;i++){integer(v.eventEndMs[i]);integer(v.availableAtMs[i]);check(v.availableAtMs[i]>=v.eventEndMs[i],'LOOKAHEAD');if(i)check(v.eventEndMs[i]>v.eventEndMs[i-1]||(v.eventEndMs[i]===v.eventEndMs[i-1]&&v.sampleIds[i]>v.sampleIds[i-1]),'INVALID_SCHEMA');arr(v.validityMask[i],d,d);v.validityMask[i].forEach(bool)}ref(v.valuesRef);hash(v.numericPolicyRef);
});
export const validateSplitSpec=closed('math.space.split.v1','sourceDigest trainIdsRef validationIdsRef testIdsRef trainCutoffMs validationCutoffMs testCutoffMs purgeMs embargoMs labelHorizonMs',v=>{
 hash(v.sourceDigest);const refs=[v.trainIdsRef,v.validationIdsRef,v.testIdsRef];refs.forEach(ref);unique(refs.map(x=>x.sha256));for(const k of fields('trainCutoffMs validationCutoffMs testCutoffMs purgeMs embargoMs labelHorizonMs'))integer(v[k]);check(v.trainCutoffMs<v.validationCutoffMs&&v.validationCutoffMs<v.testCutoffMs,'LOOKAHEAD');
});
export const validateFitArtifact=closed('math.space.fit.v1','specDigest trainingSubsetDigest trainIdsDigest trainCutoffMs splitPolicyDigest algorithmId algorithmVersion mathCommit numericPolicyRef parametersRef fitMaxAvailableAtMs seed',v=>{
 for(const k of fields('specDigest trainingSubsetDigest trainIdsDigest splitPolicyDigest numericPolicyRef'))hash(v[k]);id(v.algorithmId);id(v.algorithmVersion);check(typeof v.mathCommit==='string'&&/^[a-f0-9]{40}$/.test(v.mathCommit));ref(v.parametersRef);integer(v.trainCutoffMs);integer(v.fitMaxAvailableAtMs);check(v.fitMaxAvailableAtMs<=v.trainCutoffMs,'LOOKAHEAD');integer(v.seed);
});
export const validateSpaceRequest=closed('math.space.request.v1','operation specRef inputRefs fitRef asOfMs budgetRef execution_authority trading_authorized',v=>{
 one(v.operation,'fit','transform','inverse','distance','loss');ref(v.specRef);arr(v.inputRefs,1,32);v.inputRefs.forEach(ref);nullable(v.fitRef,ref);if(v.operation==='fit')check(v.fitRef===null,'FIT_MISMATCH');if(['transform','inverse'].includes(v.operation))check(v.fitRef!==null,'FIT_MISMATCH');integer(v.asOfMs);ref(v.budgetRef);check(v.execution_authority===false&&v.trading_authorized===false);
});
export const validateSpaceResult=closed('math.space.result.v1','status requestDigest mathCommit algorithmVersion outputRef fitRef lossRef provenanceRef maxAvailableAtMs workReceiptRef error execution_authority trading_authorized mathematicallyVerified',v=>{
 one(v.status,'RESEARCH_ONLY','REFUSED','CANCELLED');hash(v.requestDigest);check(typeof v.mathCommit==='string'&&/^[a-f0-9]{40}$/.test(v.mathCommit));id(v.algorithmVersion);for(const k of fields('outputRef fitRef lossRef provenanceRef workReceiptRef'))nullable(v[k],ref);nullable(v.maxAvailableAtMs,integer);check(v.execution_authority===false&&v.trading_authorized===false&&v.mathematicallyVerified===false);
 if(v.status==='RESEARCH_ONLY')check(v.outputRef!==null&&v.provenanceRef!==null&&v.workReceiptRef!==null&&v.maxAvailableAtMs!==null&&v.error===null);else{check(v.outputRef===null);one(v.error,'INVALID_SCHEMA','DIMENSION','SOURCE_MISMATCH','FIT_MISMATCH','LOOKAHEAD','COVERAGE','METRIC_INVALID','BUDGET_EXCEEDED','DEPENDENCY_UNAVAILABLE')}
});
export const validateLossReport=closed('math.space.loss.v1','class inverseDomain sidecars rawSourceRef comparedCount excludedCount droppedAxes droppedIdsRef perAxis geometry distributionRef alignmentRef',v=>{
 one(v.class,'EXACT','NUMERIC','CONDITIONAL','LOSSY','UNKNOWN');id(v.inverseDomain);arr(v.sidecars,0,32);v.sidecars.forEach(s=>{obj(s,fields('role ref required'));id(s.role);ref(s.ref);bool(s.required)});ref(v.rawSourceRef);integer(v.comparedCount);integer(v.excludedCount);arr(v.droppedAxes,0,256);v.droppedAxes.forEach(id);unique(v.droppedAxes);nullable(v.droppedIdsRef,ref);arr(v.perAxis,0,256);v.perAxis.forEach(a=>{obj(a,fields('axisId unit mae rmse maxAbs relative status'));id(a.axisId);id(a.unit);id(a.status);for(const k of fields('mae rmse maxAbs relative'))nullable(a[k],nonneg)});unique(v.perAxis.map(a=>a.axisId));obj(v.geometry,fields('metricId pairCount distortion neighborK recall status'));id(v.geometry.metricId);integer(v.geometry.pairCount);nullable(v.geometry.distortion,nonneg);nullable(v.geometry.neighborK,integer);nullable(v.geometry.recall,nonneg);id(v.geometry.status);nullable(v.distributionRef,ref);nullable(v.alignmentRef,ref);
});
// Packed payload is a separate verified artifact. This validator checks metadata only.
export const validateMetricTable=closed('math.space.metric-table.v1','orderedIds cloudRef fitRef metricSpecRef numericPolicyRef admittedSubsetDigest cohortRef coverageRef maxAvailableAtMs distancesRef diameterBits workReceiptRef',v=>{
 arr(v.orderedIds,1,32);v.orderedIds.forEach(id);for(let i=1;i<v.orderedIds.length;i++)check(v.orderedIds[i]>v.orderedIds[i-1],'METRIC_INVALID');for(const k of fields('cloudRef fitRef metricSpecRef cohortRef coverageRef distancesRef workReceiptRef'))ref(v[k]);hash(v.numericPolicyRef);hash(v.admittedSubsetDigest);integer(v.maxAvailableAtMs);nonneg(v.diameterBits);const n=v.orderedIds.length;check(v.distancesRef.encoding==='binary64-be-hex-v1'&&v.distancesRef.byteLength===8*n*(n-1),'METRIC_INVALID');if(n===1)check(v.diameterBits==='0000000000000000','METRIC_INVALID');
});
