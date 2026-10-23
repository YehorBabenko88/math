// Git object-ID shape only: SHA1 repositories use 40 hex, SHA256 use 64.
// This does not resolve an object, bind a repository, authenticate or attest it.
export const gitObjectId=value=>typeof value==='string'&&/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
