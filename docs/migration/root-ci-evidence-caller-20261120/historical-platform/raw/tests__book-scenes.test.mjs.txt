import test from 'node:test';import assert from 'node:assert/strict';import {bookScenes,sampleScene} from '../src/book-scenes.mjs';
test('all scenes have traceable sources',()=>{for(const s of bookScenes){assert.ok(s.page>0);assert.ok(s.source);assert.ok(s.equation)}});
test('wave satisfies zero boundary',()=>{for(const t of [0,.1,.7]){const a=sampleScene('sveshnikov-wave',t);assert.ok(Math.abs(a[0].y)<1e-12);assert.ok(Math.abs(a.at(-1).y)<1e-12)}});
test('heat mode decays',()=>{const a=sampleScene('sveshnikov-heat',0)[40].y,b=sampleScene('sveshnikov-heat',1)[40].y;assert.ok(b<a&&b>0)});
