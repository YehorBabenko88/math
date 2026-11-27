// Inert metadata status only; protected admission belongs to R.
const DENIED = Object.freeze({status:'DENIED', execution_authority:false});
export function inspectEvolution(_untrusted) { return DENIED; }
