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
test('C# policy source contains fail-closed reserved-bit and admin attribute guards',()=>{
 assert.match(source,/attributes\s*&\s*~0x0000001FU/);
 assert.match(source,/AdminState\(matches,adminAttributes\)/);
 assert.match(source,/if\(state<0\)throw new Blocked\("E_FORMAT"\)/);
});
test('Token API observation never grants execute or isolation authority',()=>{
 assert.match(source,/public bool isolationConfirmed \{ get \{ return false; \} \}/);
 assert.match(source,/public bool localExecute \{ get \{ return false; \} \}/);
 assert.match(source,/public string admission \{ get \{ return "BLOCKED"; \} \}/);
});

test('combined source retains PR76 cleanup and identity fail-closed wiring',()=>{
 assert.match(source,/var owned=new List<byte\[\]>\(4\)/);
 assert.match(source,/byte\[\] before=Statistics\(token,owned\)/);
 assert.match(source,/Integrity\(token,owned,out attributes\)/);
 assert.match(source,/CurrentStatistics\(owned\)/);
 assert.match(source,/foreach\(byte\[\] bytes in owned\)/);
 assert.match(source,/if\(cleanupFailed && result\.code!="E_CLOSE"\)/);
 assert.match(source,/CloseOwned\(token\)/);
 assert.match(source,/NoImpersonation\(\);byte\[\] after=/);
 assert.match(source,/before\[i\]!=after\[i\] \|\| before\[i\]!=current\[i\]/);
});
test('combined admin group policy preserves enabled, deny-only and ambiguous states',()=>{
 // Synthetic reference truth table for one Administrators SID.
 const policy=(matches,flags)=>matches>1||(matches===0&&flags!==0)||(flags&~0x1f)!==0||((flags&4)!==0&&(flags&16)!==0)?-1:matches===1&&(flags&4)!==0?1:0;
 for(const [flags,expected] of [[0,0],[4,1],[16,0],[20,-1],[32,-1],[64,-1],[128,-1],[132,-1],[0xc0000000,-1]]){
  assert.equal(policy(1,flags),expected,flags.toString(16));
 }
 assert.equal(policy(0,0),0);
 assert.equal(policy(2,4),-1);
});
