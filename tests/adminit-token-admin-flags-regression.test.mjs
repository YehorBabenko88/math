import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../scripts/adminit-containment/WindowsTokenObservation.cs',import.meta.url),'utf8');

// Pure arithmetic witness of the old C# AdminState branch, not native execution.
function oldAdminState(matches,attributes){
 if(matches>1||(matches===0&&attributes!==0)||((attributes&4)!==0&&(attributes&16)!==0))return -1;
 return matches===1&&(attributes&4)!==0?1:0;
}
test('P1 witness: original policy misclassifies reserved admin flags as nonadmin',()=>{
 for(const flags of [0x80,0x90,0x80000000,0x40000000]){
  assert.equal(oldAdminState(1,flags),0);
 }
});
test('C# policy source contains fail-closed reserved-bit and partial-logon guards',()=>{
 assert.match(source,/attributes\s*&\s*~0xE000007FU/);
 assert.match(source,/attributes\s*&\s*0xC0000000U/);
 assert.match(source,/AdminState\(matches,adminAttributes\)/);
 assert.match(source,/if\(state<0\)throw new Blocked\("E_FORMAT"\)/);
});
test('Token API observation never grants execute or isolation authority',()=>{
 assert.match(source,/public bool isolationConfirmed \{ get \{ return false; \} \}/);
 assert.match(source,/public bool localExecute \{ get \{ return false; \} \}/);
 assert.match(source,/public string admission \{ get \{ return "BLOCKED"; \} \}/);
});
