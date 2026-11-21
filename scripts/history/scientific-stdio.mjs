import {executeScientificGraph,scientificCapabilities} from '../../src/scientific-engine.mjs';

try {
 const chunks=[];let bytes=0;
 for await (const chunk of process.stdin) {
  bytes+=chunk.length;if(bytes>262144)throw Error('INPUT_LIMIT');chunks.push(chunk);
 }
 const caps=scientificCapabilities();
 if(caps.apiRevision!=='2.1'||!caps.features.includes('aligned-overlay-comparison'))throw Error('API_REVISION');
 const result=executeScientificGraph(JSON.parse(Buffer.concat(chunks).toString('utf8')));
 process.stdout.write(JSON.stringify(result));
} catch {
 process.stderr.write('SCIENTIFIC_REQUEST_REJECTED\n');process.exitCode=1;
}
