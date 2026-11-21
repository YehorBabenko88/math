// Strict source identity syntax for the known SHA1-format math repository.
// Never resolves Git objects or grants execution, proof or publication authority.
const sha1=/^[a-f0-9]{40}$/;
export function validatePinnedGitSource(value){
 if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw Error('INVALID_SOURCE');
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(descriptors).length!==4||!['repository','objectFormat','commit','tree'].every(k=>Object.hasOwn(descriptors,k)))throw Error('INVALID_SOURCE');
 if(!['repository','objectFormat','commit','tree'].every(k=>Object.hasOwn(descriptors[k],'value')&&descriptors[k].enumerable===true))throw Error('INVALID_SOURCE');
 const repository=descriptors.repository.value,objectFormat=descriptors.objectFormat.value;
 const commit=descriptors.commit.value,tree=descriptors.tree.value;
 if(repository!=='YehorBabenko88/math')throw Error('REPOSITORY_MISMATCH');
 if(objectFormat!=='sha1')throw Error('INVALID_OBJECT_FORMAT');
 if(typeof commit!=='string'||typeof tree!=='string'||!sha1.test(commit)||!sha1.test(tree))throw Error('GIT_OBJECT_FORMAT_MISMATCH');
 return Object.freeze({repository,objectFormat,commit,tree,trust:'UNRESOLVED_OBJECT_IDS'});
}
