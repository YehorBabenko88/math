// Ephemeral anti-replay filter for offline simulations only.
// No persistence, cross-process coordination, trusted clock, or authentication.
const hex=/^[0-9a-f]{64}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
export function newReplayFilter(){return Object.freeze({entries:Object.freeze([])});}
export function observeClaim(filter,{taskId,attempt,receiptHash}={}){
 if(!plain(filter)||!Array.isArray(filter.entries)||!filter.entries.every(x=>typeof x==='string'))throw Error('INVALID_FILTER');
 if(typeof taskId!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(taskId)||!Number.isSafeInteger(attempt)||attempt<1||attempt>2||typeof receiptHash!=='string'||!hex.test(receiptHash))throw Error('INVALID_REPLAY_KEY');
 const key=taskId+':'+attempt;
 if(filter.entries.includes(key))throw Error('REPLAY_DETECTED');
 if(filter.entries.length>=10000)throw Error('REPLAY_FILTER_FULL');
 return Object.freeze({entries:Object.freeze([...filter.entries,key])});
}
