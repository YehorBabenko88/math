import test from 'node:test';
import assert from 'node:assert/strict';
import {createBookKnowledgeIntake} from '../src/book-knowledge-intake.mjs';
const sample={id:'book-1-p12-f1',sourceTitle:'Reference',sourceLocator:'page 12 formula 1',sourceHash:'sha256:example',license:'private-review-only',excerpt:'E = mv²/2',concepts:['energy']};
test('book evidence requires human review before approval',()=>{
 const q=createBookKnowledgeIntake();q.add(sample);
 assert.throws(()=>q.transition(sample.id,'approved',{reviewer:'r',note:'checked'}),/Invalid stage/);
 q.transition(sample.id,'extracted');q.transition(sample.id,'review_required');
 assert.equal(q.transition(sample.id,'approved',{reviewer:'r',note:'verified against page'}).stage,'approved');
 assert.equal(q.list({stage:'approved'}).length,1);
 assert.equal(JSON.parse(q.exportJSON()).schema,'math-universe-book-intake/v1');
});
test('book intake rejects duplicates, ungrounded provenance and mutable output',()=>{
 const q=createBookKnowledgeIntake();assert.throws(()=>q.add({...sample,sourceLocator:''}),/Invalid locator/);
 const record=q.add(sample);record.stage='approved';
 assert.equal(q.list()[0].stage,'queued');
 assert.throws(()=>q.add(sample),/Duplicate/);
 assert.throws(()=>q.transition(sample.id,'unknown'),/Unknown stage/);
});
