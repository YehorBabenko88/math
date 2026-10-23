// Offline integration boundary. No execution, authority, persistence, or promotion.
import {validateTask} from './policy.mjs';
import {matchReceiptAndOutput} from './receipts.mjs';
import {correlateExecutionClaimWithReceiptBytes} from './claims.mjs';
import {observeClaim} from './replay.mjs';
export function inspectOfflineEvidence({task,receipt,receiptBytes,outputBytes,claim,replayFilter}={}){
 validateTask(task);
 const output=matchReceiptAndOutput(task,receipt,outputBytes);
 const identity=correlateExecutionClaimWithReceiptBytes(task,receipt,claim,receiptBytes);
 // Only register after all checks; the caller must persist the returned filter.
 const nextReplayFilter=observeClaim(replayFilter,claim);
 return Object.freeze({taskId:task.taskId,integrity:output.integrity,
  identity:identity.trust,proof:'NOT_VERIFIED',publication:'DENIED',
  nextReplayFilter});
}
