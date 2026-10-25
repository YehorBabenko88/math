// Offline source-object binding contract. No Git I/O, attestation, or publication.
import {gitObjectId} from './source-identity.mjs';
const sha1=/^[a-f0-9]{40}$/,sha256=/^[a-f0-9]{64}$/;
export function validatePinnedGitSource({repository,objectFormat,commit,tree}={}){
 if(repository!=='YehorBabenko88/math')throw Error('REPOSITORY_MISMATCH');
 if(objectFormat!=='sha1'&&objectFormat!=='sha256')throw Error('INVALID_OBJECT_FORMAT');
 if(!gitObjectId(commit)||!gitObjectId(tree))throw Error('INVALID_GIT_OBJECT');
 const pattern=objectFormat==='sha1'?sha1:sha256;
 if(!pattern.test(commit)||!pattern.test(tree))throw Error('GIT_OBJECT_FORMAT_MISMATCH');
 return Object.freeze({repository,objectFormat,commit,tree,trust:'UNRESOLVED_OBJECT_IDS'});
}
