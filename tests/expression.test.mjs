import test from 'node:test';import assert from 'node:assert/strict';import {compileExpression} from '../src/expression.mjs';import {concepts,links,neighbors} from '../src/knowledge.mjs';
test('basic expressions',()=>{assert.equal(compileExpression('x^2+2*x+1').evaluate(3),16);assert.ok(Math.abs(compileExpression('sin(pi/2)').evaluate(0)-1)<1e-12);assert.equal(compileExpression('sqrt(9)+abs(-2)').evaluate(0),5)});
test('reject JS syntax and unknown functions',()=>{for(const s of ['constructor','x;alert(1)','window.x','foo(1)','x[0]','x**2'])assert.throws(()=>compileExpression(s))});
test('reject complexity bomb',()=>assert.throws(()=>compileExpression('x+'.repeat(300)+'x')));
test('graph references resolve',()=>{const ids=new Set(concepts.map(c=>c.id));for(const edge of links){assert.ok(ids.has(edge.from));assert.ok(ids.has(edge.to))}assert.ok(neighbors('signals').length>0)});
