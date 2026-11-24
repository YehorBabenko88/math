import {encodeBookJSON} from './postgres-codec.mjs';

// Lossless encoding removes JSON parity as a blocker. No authenticated cutover
// controller currently verifies operator identity, source quiescence and backup.
// Dataset hashes or caller booleans cannot replace those operational contracts.
export const BOOK_POSTGRES_JSON_PARITY=true;
export const BOOK_POSTGRES_BLOCKERS=Object.freeze(['operator-cutover-prerequisites']);
export function bookPostgresJSONCompatible(input){
 encodeBookJSON(input);return true;
}
