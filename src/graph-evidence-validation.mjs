import {validateScientificExperiment} from './scientific-experiment-validation.mjs';
// Read-only association of independent citation examples with a graph context.
// These supplied observations do not validate the graph output, units or parameters.
export function validateGraphNodeEvidence(graph,nodeId,spec){
 if(!graph||typeof graph.describe!=='function'||typeof graph.execute!=='function')throw Error('Invalid experiment graph');
 if(typeof nodeId!=='string'||!graph.describe().some(n=>n.id===nodeId))throw Error('Unknown experiment node');
 const evaluated=graph.execute(nodeId);
 if(!evaluated||evaluated.id!==nodeId)throw Error('Graph evaluation mismatch');
 const citationExamples=validateScientificExperiment(spec);
 return Object.freeze({nodeId,nodeType:evaluated.type,relationship:'independent-citation-examples',nodeOutputValidated:false,citationExamples,trace:evaluated.trace});
}
