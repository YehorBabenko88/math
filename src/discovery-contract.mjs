import { encodeMetadata, decodeMetadata } from './math-universe-codec.mjs';

const fail = () => { throw new Error('INVALID_DISCOVERY_REQUEST'); };
const fields = ['schema','developmentRef','policyRef','catalogRef','methodRefs','portStateRefs','maxIntents'];
function ref(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail();
  return value;
}
function roster(values, max) {
  if (!Array.isArray(values) || values.length > max) fail();
  const result = values.map(ref);
  if (new Set(result).size !== result.length) fail();
  return Object.freeze(result.sort());
}
// Object admission through the shared codec; no caller bytes or callbacks.
export function validateDiscoveryRequest(input) {
  const value = decodeMetadata(encodeMetadata(input));
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== fields.length ||
      fields.some(key => !Object.hasOwn(value,key)) ||
      value.schema !== 'math.discovery.request.v1') fail();
  const {developmentRef,policyRef,catalogRef,maxIntents} = value;
  if (!Number.isSafeInteger(maxIntents) || maxIntents < 1 || maxIntents > 1000) fail();
  const methodRefs = roster(value.methodRefs,128);
  const portStateRefs = roster(value.portStateRefs,256);
  if (methodRefs.length * portStateRefs.length > maxIntents)
    throw new Error('DISCOVERY_BUDGET_EXCEEDED');
  return Object.freeze({schema:value.schema,developmentRef:ref(developmentRef),
    policyRef:ref(policyRef),catalogRef:ref(catalogRef),methodRefs,portStateRefs,maxIntents});
}
