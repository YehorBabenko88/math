import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScientificExperiment} from '../src/scientific-experiment-validation.mjs';
const provenance={claim:'Velocity example',referenceId:'textbook-kinematics',locator:'chapter 1, section 2'};
test('accepts numerically equal quantities in different SI-compatible units',()=>{
 const result=validateScientificExperiment({...provenance,observations:[{expected:10,expectedUnit:'m/s',actual:36,actualUnit:'km/h'}]});
 assert.equal(result.status,'reproduced');assert.equal(result.dimensionChecked,true);
});
test('rejects physically incompatible comparisons',()=>{assert.throws(()=>validateScientificExperiment({...provenance,observations:[{expected:10,expectedUnit:'m',actual:10,actualUnit:'s'}]}),/Incompatible/)});
test('detects numerical mismatch after converting units',()=>{assert.equal(validateScientificExperiment({...provenance,observations:[{expected:10,expectedUnit:'m/s',actual:18,actualUnit:'km/h'}]}).status,'contradicted')});
test('does not promote a claim without evidence',()=>{assert.equal(validateScientificExperiment({...provenance}).status,'untested')});
test('requires explicit units and provenance',()=>{assert.throws(()=>validateScientificExperiment({...provenance,observations:[{expected:1,actual:1}]}));assert.throws(()=>validateScientificExperiment({...provenance,referenceId:''}))});
