// Pure consistency check between an independently resolved Git source and
// untrusted task/receipt/claim. Never performs Git I/O or grants trust.
import {validatePinnedGitSource} from './pinned-source.mjs';
import {validateTask} from './policy.mjs';
import {validateReceipt,matchReceipt} from './receipts.mjs';
import {validateExecutionClaim,correlateExecutionClaim} from './claims.mjs';
export function correlatePinnedSource(source,task,receipt,claim){
 const pinned=validatePinnedGitSource(source);
 validateTask(task);
 validateReceipt(receipt);
 validateExecutionClaim(claim);
 if(task.sourceCommit!==pinned.commit||receipt.sourceCommit!==pinned.commit||claim.sourceCommit!==pinned.commit)throw Error('SOURCE_COMMIT_MISMATCH');
 if(task.taskId!==receipt.taskId||task.taskId!==claim.taskId||receipt.attempt!==claim.attempt)throw Error('SOURCE_ATTEMPT_MISMATCH');
 // Preserve specific source diagnostics after schema validation, before full binding.
 matchReceipt(task,receipt);
 correlateExecutionClaim(task,receipt,claim);
 return Object.freeze({commit:pinned.commit,tree:pinned.tree,trust:'UNRESOLVED_OBJECT_IDS',proof:'NOT_VERIFIED',publication:'DENIED'});
}
