// Deny-only developer candidate. Never inspect or authorize untrusted input.
export function assessProtectedAdmission(_untrusted) {
  return Object.freeze({
    source: 'UNATTESTED', fit: 'NOT_PROVIDED', method: 'UNVERIFIED',
    receipt: 'UNATTESTED', execution: 'DENIED', publication: 'DENIED',
    write: 'DENIED', trading: 'DENIED'
  });
}
