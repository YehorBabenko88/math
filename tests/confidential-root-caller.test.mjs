import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const pin='82bf1578c5e36bafd76615661fbb3fe4e22dca55';
const guard="github.head_ref != 'fix/walk-forward-forecast-guard' && github.repository == 'YehorBabenko88/math' && github.event.pull_request.head.repo.full_name == github.repository";
function check(source){
 const text=source.replaceAll('\r\n','\n');const top=text.split('permissions:\n')[1]?.split('jobs:\n')[0];
 assert.equal(top,'  contents: read\n  actions: read\n  id-token: write\n');
 const jobs=text.slice(text.indexOf('jobs:\n')+6);assert.deepEqual(jobs.match(/^  [A-Za-z0-9_-]+:$/gm),['  qualification:']);
 assert.equal(jobs,'  qualification:\n    if: '+guard+'\n    permissions:\n      contents: read\n      actions: read\n      id-token: write\n    uses: YehorBabenko88/unified-system/.github/workflows/ci-evidence-collector.yml@'+pin+'\n    with:\n      collector-sha: '+pin+'\n');
 assert(!/secrets:|workflow_dispatch|pull_request_target|checkout@/.test(text));return true;
}
test('Root collector caller is closed configuration only, with refusal calibrations',()=>{
 const source=readFileSync(new URL('../.github/workflows/confidential-synthetic-e2e.yml',import.meta.url),'utf8');assert.equal(check(source),true);
 for(const wrong of [source.replace('collector-sha: '+pin,'collector-sha: '+'0'.repeat(40)),source.replace('YehorBabenko88/unified-system','unapproved/repository'),source.replace('contents: read','contents: write'),source.replace('actions: read','actions: write'),source.replace("github.head_ref != 'fix/walk-forward-forecast-guard' && ",''),source+'  extra-job:\n    runs-on: ubuntu-latest\n',source+'    secrets: inherit\n'])assert.throws(()=>check(wrong));
});
