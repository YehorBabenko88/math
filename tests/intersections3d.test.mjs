import test from 'node:test';import assert from 'node:assert/strict';import {intersectionPoints} from '../src/intersections3d.mjs';
test('two planes intersect along a line',()=>{const p=intersectionPoints((x,y,z)=>z,(x,y,z)=>y,{steps:20,tolerance:.01});assert.ok(p.length>10);for(const v of p){assert.ok(Math.abs(v.y)<=.01&&Math.abs(v.z)<=.01)}});
test('disjoint zero sets have no samples',()=>assert.equal(intersectionPoints(()=>1,()=>2).length,0));
test('bad sampling configuration rejected',()=>assert.throws(()=>intersectionPoints(()=>0,()=>0,{steps:100})));
