import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const ROOT_TOOL='82bf1578c5e36bafd76615661fbb3fe4e22dca55';
export const SOURCE_BASE='b3cb935aee7d6569d6fd0cfaff70ea9b9e5f0df3';
export const REQUIRED_ROOT_CELLS=Object.freeze(['linux-22-16','linux-22-18','linux-24-16','linux-24-18']);
export const HISTORICAL_ARCHIVES='docs/migration/root-ci-evidence-caller-20261120/historical-platform/raw/';
const digest=value=>createHash('sha256').update(value).digest('hex');
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const key=x=>JSON.stringify([x.file,x.parent??null,x.name,x.occurrence]);
const ROOT_HOSTED_FILES=["tests/confidential-collector-context.test.mjs","tests/confidential-collector-oidc.test.mjs","tests/confidential-pr64-blocked-projection.test.mjs","tests/confidential-public-privacy.test.mjs","tests/confidential-receipt-schema.test.mjs","tests/confidential-stage-codes.test.mjs","tests/confidential-synthetic-bundle.test.mjs","tests/confidential-synthetic-session.test.mjs"];
const EXCLUSIVE_RETIRED=["src/confidential-collector/oidc-client.mjs","src/confidential-collector/context.mjs","src/confidential-collector/session.mjs","src/confidential-collector/synthetic-bundle.mjs","src/confidential-collector/public-schema.mjs","src/confidential-collector/worker.mjs","scripts/confidential-qualification/hosted.mjs",".github/workflows/confidential-collector.yml","tests/confidential-collector-context.test.mjs","tests/confidential-collector-oidc.test.mjs","tests/confidential-pr64-blocked-projection.test.mjs","tests/confidential-public-privacy.test.mjs","tests/confidential-receipt-schema.test.mjs","tests/confidential-stage-codes.test.mjs","tests/confidential-synthetic-bundle.test.mjs","tests/confidential-synthetic-session.test.mjs","tests/confidential-pinned-loader.test.mjs","tests/fixtures/confidential-collector/context.mjs"];
export const loadHistoricalInventory=()=>json('scripts/platform-test-inventory.json');
export const loadTransferLedger=()=>json('scripts/platform-source-transfers.json');
export function verifyTransferLedger(current,historical,transfer){
 // Bind the actual supplied object before deriving any current/moved identity.
 // A disk hash alone does not authenticate a separately supplied object.
 const historicalBytes=readFileSync('scripts/platform-test-inventory.json');
 const baselineEntry=execFileSync('git',['--no-replace-objects','ls-tree',SOURCE_BASE,'--','scripts/platform-test-inventory.json'],{encoding:'utf8',windowsHide:true}).trim();
 const match=/^100644 blob ([a-f0-9]{40})\tscripts\/platform-test-inventory\.json$/.exec(baselineEntry);
 assert.ok(match,'Immutable historical ledger must exist in the exact b3 tree');
 assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from('blob '+historicalBytes.length+'\0'),historicalBytes])).digest('hex'),match[1],'Historical raw ledger changed from b3');
 const boundHistorical=JSON.parse(historicalBytes);
 assert.deepEqual(historical,boundHistorical,'Provided historical object differs from exact b3 ledger');
 historical=boundHistorical;
 assert.equal(current.schema,'math.current-platform-case-inventory.v2');
 assert.equal(transfer.schema,'math.root-ci-event-transfer.v1');
 for(const item of [current,transfer]){assert.equal(item.source_base,SOURCE_BASE);assert.equal(item.Root_tool,ROOT_TOOL);assert.equal(item.historical_inventory_sha256,digest(readFileSync('scripts/platform-test-inventory.json')));}
 assert.equal(historical.tests.length,1234);assert.equal(transfer.events.length,34);
 const exactMoved=historical.tests.filter(x=>ROOT_HOSTED_FILES.includes(x.file)||x.file==='tests/confidential-pinned-loader.test.mjs');
 assert.deepEqual(transfer.events.map(x=>x.original),exactMoved,'Only the exact approved original34 event identities may move');
 const old=new Map(historical.tests.map(x=>[key(x),x]));const moved=new Set();
 for(const item of transfer.events){
  assert.deepEqual(item.original,old.get(key(item.original)));assert.equal(item.original.platform,'linux');
  assert.equal(moved.has(key(item.original)),false);moved.add(key(item.original));
  assert.deepEqual(item.required_cells,REQUIRED_ROOT_CELLS);assert.equal(item.source_only_mapping_is_execution,false);
  assert.equal(item.status,'HELD_REQUIRED_ORIGINAL_PLATFORM_PROOF');
  const target=item.original.file==='tests/confidential-pinned-loader.test.mjs'?'tools/ci_evidence/tests/inert_loader.mjs':'tools/ci_evidence/tests/hosted/'+item.original.file.slice(6);
  assert.equal(item.target,target);
 }
 assert.equal(transfer.events.filter(x=>x.original.file==='tests/confidential-pinned-loader.test.mjs').length,3);
 assert.equal(transfer.events.filter(x=>x.original.file!=='tests/confidential-pinned-loader.test.mjs').length,31);
 assert.equal(transfer.retired_files.length,18);assert.equal(new Set(transfer.retired_files.map(x=>x.source)).size,18);
 assert.deepEqual(transfer.retired_files.map(x=>x.source).sort(),[...EXCLUSIVE_RETIRED].sort());
 const lines=execFileSync('git',['--no-replace-objects','ls-tree','-r',SOURCE_BASE],{encoding:'utf8',windowsHide:true}).trim().split('\n');
 const sourceTree=new Map(lines.map(line=>{const found=/^100644 blob ([a-f0-9]{40})\t(.+)$/.exec(line);return found?[found[2],found[1]]:[];}).filter(x=>x.length));
 for(const entry of transfer.retired_files){
  assert.equal(entry.source_commit,SOURCE_BASE);assert.equal(entry.blob_oid,sourceTree.get(entry.source),'Archive must match exact source-base Git tree');assert.equal(existsSync(entry.source),false,'Retired executable returned: '+entry.source);
  const bytes=readFileSync(entry.archive);assert.equal(digest(bytes),entry.sha256);
  assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex'),entry.blob_oid);
 }
 const retained=historical.tests.filter(x=>!moved.has(key(x)));
 assert.deepEqual(current.tests.slice(0,retained.length),retained,'Every remaining original case and metadata must survive unchanged');
 assert.equal(current.tests.length,1201);assert.equal(current.tests.length-retained.length,1);
 assert.deepEqual(current.tests.at(-1),{file:'tests/confidential-root-caller.test.mjs',name:'Root collector caller is closed configuration only, with refusal calibrations',parent:null,line:10,column:1,platform:'cross',occurrence:1,destination:'tests/confidential-root-caller.test.mjs',added:true});
 assert.equal(new Set(current.tests.map(key)).size,1201);assert.equal(transfer.coverage,'HELD');assert.equal(transfer.release_status,'NO_GO');
 return {currentCases:1201,transferredEvents:34,RootHostedEvents:31,RootStaticEvents:3};
}
export function loadCurrentInventory(){const current=json('scripts/platform-current-inventory.json');verifyTransferLedger(current,loadHistoricalInventory(),loadTransferLedger());return current;}
export function historicalDestination(path,read){return read(HISTORICAL_ARCHIVES+path.replaceAll('/','__')+'.txt');}
export function verifyCurrentSourceFiles({read=path=>readFileSync(path)}={}){
 const proof=json('scripts/platform-current-source-proof.json');assert.equal(proof.schema,'math.current-test-source-proof.v2');assert.equal(proof.source_base,SOURCE_BASE);assert.equal(proof.Root_tool,ROOT_TOOL);
 const discover=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const path=directory+'/'+entry.name;return entry.isDirectory()?discover(path):/\.(?:test|windows|cross)\.mjs$/.test(entry.name)?[path]:[];});
 assert.deepEqual(discover('tests').sort(),Object.keys(proof.files).sort(),'Exact current executable test-file inventory required');
 assert.equal(Object.keys(proof.files).length,207);
 for(const [path,expected] of Object.entries(proof.files))assert.equal(digest(read(path)),expected,'Current assertion bytes changed: '+path);
 const current=loadCurrentInventory();assert.deepEqual([...new Set(current.tests.map(x=>x.destination))].sort(),Object.keys(proof.files).sort(),'Current cases must own every executable test source');
 return proof;
}
export function sourceProofDigest(historical,current){return digest(JSON.stringify({historical,current,transfer:loadTransferLedger(),inventory:loadCurrentInventory()}));}
/** No source/static mapping is promoted into missing four-cell hosted execution. */
export function heldRootCoverage(){
 const ledger=loadTransferLedger();return Object.freeze({status:'HELD',releaseStatus:'NO_GO',RootTool:ROOT_TOOL,transferredEventIds:ledger.events.length,requiredCells:[...REQUIRED_ROOT_CELLS],missingProof:'ROOT_R1_HAS_NO_FOUR_CELL_RUNTIME_RECEIPT_PROTOCOL',sourceMappingIsExecution:false,operationalAcceptance:'UNQUALIFIED',nativeAcceptance:'BLOCKED'});
}
