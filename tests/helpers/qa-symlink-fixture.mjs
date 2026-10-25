import {symlinkSync} from 'node:fs';
// Test-fixture seam only; never used by the evidence validator.
export function createSymlinkFixture(t,target,path,type,{platform=process.platform,create=symlinkSync}={}){
 try{create(target,path,type);}
 catch(error){
  if(platform!=='win32'||!['EPERM','EACCES'].includes(error?.code))throw error;
  t.skip(`BLOCKED: Windows denied ${type} symlink fixture creation (${error.code}); validator symlink rejection was NOT_RUN`);
  return false;
 }
 return true;
}
