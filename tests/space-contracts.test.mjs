import test from 'node:test';
import assert from 'node:assert/strict';
import * as d from '../src/space-contracts.mjs';
import {readFileSync} from 'node:fs';
const f=JSON.parse(readFileSync(new URL('./fixtures/space_contract_v1.json',import.meta.url)));
test('eight exports',()=>assert.equal(Object.keys(d).length,8));
for(const [name,fn] of Object.entries(d))test(name+' rejects empty DTO',()=>assert.throws(()=>fn({}),/INVALID_SCHEMA/));
test('sphere dimensions and detached result',()=>{const v=d.validateSpaceSpec(f.sphere);assert.notEqual(v,f.sphere);assert.throws(()=>d.validateSpaceSpec({...f.sphere,parameters:{...f.sphere.parameters,intrinsicDimension:4}}),/DIMENSION/)});
test('future fit refuses',()=>assert.throws(()=>d.validateFitArtifact({...f.fit,fitMaxAvailableAtMs:11}),/LOOKAHEAD/));
test('fit cutoff accepted structurally',()=>assert.equal(d.validateFitArtifact(f.fit).trainCutoffMs,10));
test('getter not invoked',()=>{let called=false;assert.throws(()=>d.validateSpaceSpec({get schema(){called=true;return ''}}));assert.equal(called,false)});

test('shared codec rejects both signs of infinity and NaN and negative zero',()=>{for(const radius of ['7ff0000000000000','fff0000000000000','7ff8000000000000','fff8000000000000','8000000000000000'])assert.throws(()=>d.validateSpaceSpec({...f.sphere,parameters:{...f.sphere.parameters,radius}}),/INVALID_SCHEMA/)});
test('null prototype metadata round trip',()=>{const v=d.validateSpaceSpec(f.sphere);assert.equal(Object.getPrototypeOf(v),null);assert.equal(d.validateSpaceSpec(v).spaceId,v.spaceId)});
test('fractional metadata rejected',()=>assert.throws(()=>d.validateSpaceSpec({...f.sphere,metric:{...f.sphere.metric,parameters:{scale:0.5}}}),/INVALID_SCHEMA/));
test('packed metadata length and singleton diameter',()=>{const ref={...f.fit.parametersRef};const table={schema:'math.space.metric-table.v1',orderedIds:['a'],cloudRef:ref,fitRef:ref,metricSpecRef:ref,numericPolicyRef:f.fit.numericPolicyRef,admittedSubsetDigest:f.fit.trainingSubsetDigest,cohortRef:ref,coverageRef:ref,maxAvailableAtMs:10,distancesRef:{...ref,encoding:'binary64-be-hex-v1',byteLength:0},diameterBits:'0000000000000000',workReceiptRef:ref};assert.equal(d.validateMetricTable(table).orderedIds.length,1);assert.throws(()=>d.validateMetricTable({...table,diameterBits:'3ff0000000000000'}),/METRIC_INVALID/);assert.throws(()=>d.validateMetricTable({...table,distancesRef:{...table.distancesRef,byteLength:16}}),/METRIC_INVALID/)});
