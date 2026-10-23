import test from 'node:test';import assert from 'node:assert/strict';import {isosurface} from '../src/isosurface.mjs';
test('sphere mesh vertices lie close to surface',()=>{const triangles=isosurface((x,y,z)=>x*x+y*y+z*z-1,{steps:18});assert.ok(triangles.length>100);for(const tri of triangles)for(const p of tri)assert.ok(Math.abs(p.x*p.x+p.y*p.y+p.z*p.z-1)<.04)});
test('plane produces triangles',()=>{const triangles=isosurface((x,y,z)=>z,{steps:8});assert.ok(triangles.length>0);for(const tri of triangles)for(const p of tri)assert.ok(Math.abs(p.z)<1e-12)});
test('empty level set has no triangles',()=>assert.equal(isosurface(()=>5,{steps:8}).length,0));
test('reject expensive grid',()=>assert.throws(()=>isosurface(()=>0,{steps:100})));
