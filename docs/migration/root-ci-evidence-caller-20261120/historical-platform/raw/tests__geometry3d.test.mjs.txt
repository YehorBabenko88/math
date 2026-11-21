import test from 'node:test';import assert from 'node:assert/strict';import {surfacePoint,project,mesh,saddlePlaneIntersection} from '../src/geometry3d.mjs';
test('saddle points satisfy equation',()=>{for(const [x,y] of [[0,0],[.5,-.8],[1,1]]){const p=surfacePoint('saddle',x,y);assert.ok(Math.abs(p.z-(x*x-y*y))<1e-12)}});
test('intersection satisfies both surfaces',()=>{for(const line of saddlePlaneIntersection())for(const p of line){assert.ok(Math.abs(p.z)<1e-12);assert.ok(Math.abs(p.x*p.x-p.y*p.y)<1e-12)}});
test('mesh and projection finite',()=>{const m=mesh('wave',{steps:10,time:1});assert.equal(m.vertices.length,121);for(const p of m.vertices){const q=project(p);assert.ok(Number.isFinite(q.x)&&Number.isFinite(q.y))}});
test('invalid mesh resolution rejected',()=>assert.throws(()=>mesh('cone',{steps:500})));
