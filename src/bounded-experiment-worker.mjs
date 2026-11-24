import {parentPort,workerData} from 'node:worker_threads';
import {evaluateMathRequest} from './math-engine-server.mjs';
try {parentPort.postMessage({result:evaluateMathRequest(workerData)})}
catch {parentPort.postMessage({error:'INVALID_RESEARCH_REQUEST'})}
