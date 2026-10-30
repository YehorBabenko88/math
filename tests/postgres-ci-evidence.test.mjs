import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path=new URL('../.github/workflows/postgres-integration.yml',import.meta.url);
function checkEvidence(text){
 for(const name of ['Record exact source and dependency provenance','Upload source provenance']){
  const block=text.split('      - name: '+name+'\n')[1]?.split('\n      - ')[0];
  assert.ok(block,name+' exists');
  assert.match(block,/^        if: always\(\)$/m,name+' must run after failure/cancellation');
 }
}
test('PostgreSQL provenance collection and upload survive failing suites without granting coverage success',()=>{
 const text=readFileSync(path,'utf8').replaceAll('\r\n','\n');
 checkEvidence(text);
 for(const name of ['Record exact source and dependency provenance','Upload source provenance']){
  const mutated=text.replace('      - name: '+name+'\n        if: always()','      - name: '+name+'\n        if: success()');
  assert.throws(()=>checkEvidence(mutated),/must run/);
 }
 assert.match(text,/MATRIX_RESULT: \$\{\{ needs.postgres-integration.result \}\}/);
 assert.ok(text.includes('run: test "$MATRIX_RESULT" = success'));
});
test('PostgreSQL retains the explicitly isolated branch exception on both jobs and the full matrix elsewhere',()=>{
 const text=readFileSync(path,'utf8');
 for(const id of ['postgres-integration','full-ci-coverage']){
  const block=text.split('  '+id+':')[1].split(/\r?\n  [a-z]/)[0];
  assert.ok(block.includes("github.head_ref != 'fix/walk-forward-forecast-guard'"));
  assert.ok(block.includes("github.ref != 'refs/heads/fix/walk-forward-forecast-guard'"));
  if(id==='full-ci-coverage')assert.match(block,/always\(\)/);
 }
 assert.match(text,/node: \['22', '24'\]/);assert.match(text,/postgres: \['16', '18'\]/);
 assert.doesNotMatch(text,/exclude:|include:|continue-on-error/);
});
