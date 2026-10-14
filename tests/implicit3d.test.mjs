import test from 'node:test';import assert from 'node:assert/strict';import {compileImplicit,implicitPoints} from '../src/implicit3d.mjs';
test('sphere implicit function',()=>{const f=compileImplicit('x^2+y^2+z^2=1');assert.ok(Math.abs(f(1,0,0))<1e-12);assert.equal(f(0,0,0),-1);assert.equal(f(2,0,0),3)});
test('plane equation',()=>{const f=compileImplicit('x+y+z=0');assert.equal(f(1,2,-3),0)});
test('invalid syntax rejected',()=>{assert.throws(()=>compileImplicit('x=1=2'));assert.throws(()=>compileImplicit('window.x=1'))});
test('surface sampling bounded',()=>{const pts=implicitPoints(compileImplicit('x^2+y^2+z^2=1'),{steps:12});assert.ok(pts.length>0&&pts.length<13**3)});
