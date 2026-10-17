import {json} from './queue-contract.mjs';

// jsonb cannot represent every string accepted by the existing SQLite contract.
// This blocker is deliberately global: passing a particular dataset does not
// establish complete backend parity. Do not remove it without lossless storage
// and native-contract regression tests. No automatic selection consumes it.
export const BOOK_POSTGRES_BLOCKERS=Object.freeze(['native-json-text-parity']);
export function bookPostgresJSONCompatible(input){
 const value=json(input,8*1024*1024);
 const string=s=>!s.includes('\0')&&s.isWellFormed();
 function check(v){
  if(typeof v==='string')return string(v);
  if(!v||typeof v!=='object')return true;
  return Object.keys(v).every(k=>string(k)&&check(v[k]));
 }
 return check(value);
}
