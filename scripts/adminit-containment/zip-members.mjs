// Offline ZIP member-name policy. No archive parsing, extraction, or execution.
const expected=new Set(['AdminitSyntheticHarness.exe','package.json']);
export function validateZipMemberNames(names){
 if(!Array.isArray(names)||names.length!==2||!names.every(x=>typeof x==='string'))throw Error('ZIP_MEMBERS_INVALID');
 const seen=new Set();
 for(const name of names){
  if(name.includes('\\')||name.includes('/')||name.includes(':')||name.includes('\0')||name==='.'||name==='..'||name!==name.normalize('NFC')||!expected.has(name)||seen.has(name.toLowerCase()))throw Error('ZIP_MEMBERS_INVALID');
  seen.add(name.toLowerCase());
 }
 if(seen.size!==2)throw Error('ZIP_MEMBERS_INVALID');
 return Object.freeze({inventory:'EXPECTED_NAMES_ONLY',archiveBytes:'NOT_VERIFIED',extraction:'DENIED',execution:'DENIED'});
}
