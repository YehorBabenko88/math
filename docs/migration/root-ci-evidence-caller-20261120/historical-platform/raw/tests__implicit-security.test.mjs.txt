import test from 'node:test';import assert from 'node:assert/strict';import {compileImplicit} from '../src/implicit3d.mjs';
test('coordinates independent from mathematical constants',()=>{const f=compileImplicit('x+y+z+pi+e=0');assert.ok(Math.abs(f(1,2,3)-(6+Math.PI+Math.E))<1e-12)});
test('functions and exponent precedence',()=>{assert.ok(Math.abs(compileImplicit('sin(pi/2)+sqrt(4)=3')(0,0,0))<1e-12);assert.equal(compileImplicit('-x^2=-4')(2,0,0),0)});
test('reject unsafe expressions',()=>{for(const s of ['x.constructor=1','x;alert(1)=0','foo(x)=0','x=1=2','x[0]=1'])assert.throws(()=>compileImplicit(s))});
