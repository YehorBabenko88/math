import { validateDiscoveryRequest } from './discovery-contract.mjs';

// Inert intents only. L owns registration; M owns eligibility.
export function enumerateDiscovery(request) {
  const {developmentRef,policyRef,catalogRef,methodRefs,portStateRefs} =
    validateDiscoveryRequest(request);
  const intents = [];
  for (const methodRef of methodRefs)
    for (const portStateRef of portStateRefs)
      intents.push(Object.freeze({schema:'math.discovery.intent.v1',
        developmentRef,policyRef,catalogRef,methodRef,portStateRef,
        ordinal:intents.length,status:'UNREGISTERED'}));
  return Object.freeze(intents);
}
