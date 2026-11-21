import test from 'node:test';
import assert from 'node:assert/strict';
import {fromUnit,convertUnit,addQuantities,multiplyQuantities,divideQuantities,describeDimensions} from '../src/si-dimensions.mjs';
test('converts speeds and lengths with explicit units',()=>{assert.equal(convertUnit(36,'km/h','m/s'),10);assert.equal(convertUnit(2,'km','m'),2000)});
test('rejects dimensionally invalid additions',()=>{assert.throws(()=>addQuantities(fromUnit(1,'m'),fromUnit(1,'s')),/incompatible/)});
test('force multiplied by distance has energy dimensions',()=>{const work=multiplyQuantities(fromUnit(2,'N'),fromUnit(3,'m'));assert.equal(work.siValue,6);assert.equal(describeDimensions(work.dimensions),describeDimensions(fromUnit(1,'J').dimensions))});
test('distance divided by time has velocity dimensions',()=>{const velocity=divideQuantities(fromUnit(100,'m'),fromUnit(10,'s'));assert.equal(velocity.siValue,10);assert.deepEqual(velocity.dimensions,fromUnit(1,'m/s').dimensions)});
test('rejects incompatible conversions, unknown units and zero division',()=>{assert.throws(()=>convertUnit(1,'m','kg'));assert.throws(()=>fromUnit(1,'unknown'));assert.throws(()=>divideQuantities(fromUnit(1,'m'),fromUnit(0,'s')))});
