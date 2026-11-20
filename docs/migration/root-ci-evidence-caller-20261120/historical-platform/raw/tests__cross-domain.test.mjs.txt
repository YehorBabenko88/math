import test from 'node:test';import assert from 'node:assert/strict';import {normalizeSeries,simulateOverlay,syntheticSeries,parseSeriesCsv} from '../src/cross-domain.mjs';
test('normalization is zero mean unit variance',()=>{const x=normalizeSeries([1,2,3,4,5,6,7,8]).values;assert.ok(Math.abs(x.reduce((a,b)=>a+b,0))<1e-10);assert.ok(Math.abs(x.reduce((a,b)=>a+b*b,0)/8-1)<1e-10)});
test('Landau deterministic and bounded on synthetic input',()=>{const x=syntheticSeries(100),a=simulateOverlay(x),b=simulateOverlay(x);assert.deepEqual(a.output,b.output);assert.equal(a.output.length,100);assert.ok(a.output.every(Number.isFinite))});
test('logistic map simulation',()=>{const r=simulateOverlay(syntheticSeries(40),{model:'logistic'});assert.equal(r.output.length,40)});
test('reject invalid data and unsupported fitting',()=>{assert.throws(()=>normalizeSeries(Array(10).fill(1)));assert.throws(()=>simulateOverlay(syntheticSeries(30),{mode:'fit'}));assert.throws(()=>simulateOverlay(syntheticSeries(30),{parameters:{oops:1}}))});
test('CSV parses last numeric column',()=>{assert.deepEqual(parseSeriesCsv('t;value\n'+Array.from({length:8},(_,i)=>i+';'+(i+1)).join('\n')),[1,2,3,4,5,6,7,8])});
