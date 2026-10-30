import {symlinkSync} from 'node:fs';
// Test-fixture seam only; never used by the evidence validator.
export function createSymlinkFixture(t,target,path,type,{platform=process.platform,create=symlinkSync,strict=Boolean(process.env.MATH_CI_PLATFORM_PROFILE)}={}){
 try{create(target,path,platform==='win32'&&type==='dir'?'junction':type);}
 catch(error){
  if(strict)throw error;
  if(platform!=='win32'||!['EPERM','EACCES'].includes(error?.code))throw error;
  t.skip(`BLOCKED: Windows denied ${type} symlink fixture creation (${error.code}); validator symlink rejection was NOT_RUN`);
  return false;
 }
 return true;
}
