import {validateScientificExperiment} from './scientific-experiment-validation.mjs';
// Read-only bridge: attach validated evidence to an existing graph node.
// No changes to graph execution or to user data.
export function validateGraphNodeEvidence(graph,nodeId,spec){
 if(!graph||typeof graph.describe!=='function'||typeof graph.execute!=='function')throw Error('Invalid experiment graph');
 if(typeof nodeId!=='string'||!graph.describe().some(n=>n.id===nodeId))throw Error('Unknown experiment node');
 const evaluated=graph.execute(nodeId);
 if(!evaluated||evaluated.id!==nodeId)throw Error('Graph evaluation mismatch');
 const result=validateScientificExperiment(spec);
 return Object.freeze({nodeId,nodeType:evaluated.type,evidence:result,trace:evaluated.trace});
}
