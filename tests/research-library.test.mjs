import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeResearchReference,createResearchLibrary,importResearchLibrary} from '../src/research-library.mjs';
const paper={arxivId:'2401.01234v2',title:'Example mathematical research',authors:['Researcher A'],retrievedAt:'2026-10-14T00:00:00Z'};
test('normalizes a versioned reference and preserves unverified provenance',()=>{const p=normalizeResearchReference(paper);assert.equal(p.baseId,'2401.01234');assert.equal(p.version,'2');assert.equal(p.verification,'unverified');assert.equal(p.canonicalUrl,'https://arxiv.org/abs/2401.01234v2')});
test('library JSON roundtrip preserves paper versions',()=>{const lib=createResearchLibrary();lib.add(paper);lib.add({...paper,arxivId:'2401.01234v3'});const restored=importResearchLibrary(lib.exportJSON());assert.equal(restored.list().length,2);assert.equal(restored.get('2401.01234v3').version,'3')});
test('rejects unsafe or malformed reference metadata',()=>{assert.throws(()=>normalizeResearchReference({...paper,arxivId:'javascript:alert(1)'}));assert.throws(()=>normalizeResearchReference({...paper,title:''}));assert.throws(()=>importResearchLibrary({schemaVersion:2,references:[]}))});
