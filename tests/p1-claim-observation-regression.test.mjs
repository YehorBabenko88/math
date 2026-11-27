import test from 'node:test';
import assert from 'node:assert/strict';
import {assessScientificClaim} from '../src/scientific-claim-checks.mjs';

import {validateScientificExperiment} from '../src/scientific-experiment-validation.mjs';

const claim = {claim:'Synthetic claim',referenceId:'fixture',locator:'case'};

test('missing observation slots cannot reproduce a claim', () => {
  assert.throws(
    () => assessScientificClaim({...claim, observations: new Array(1)}),
    {message:'Non-finite observation'},
  );
});

test('a caller-provided map cannot replace numeric comparison', () => {
  const observations = [{expected:1, actual:2}];
  observations.map = () => [{passes:true}];
  const result = assessScientificClaim({...claim, observations, tolerance:0});
  assert.equal(result.status, 'contradicted');
  assert.deepEqual(result.observations, [{expected:1, actual:2, absoluteError:1, passes:false}]);
});


test('experiment validation cannot skip unit comparison', () => {
  const observations = [{expected:1, actual:1, expectedUnit:'m', actualUnit:'s'}];
  observations.map = () => [{expected:1, actual:1}];
  assert.throws(
    () => validateScientificExperiment({...claim, observations}),
    /incompatible/i,
  );
});

test('missing experiment observations cannot reproduce a claim', () => {
  assert.throws(
    () => validateScientificExperiment({...claim, observations: new Array(1)}),
    {message:'Invalid observation'},
  );
});

test('validation rejects proxied observation counts before reading length', () => {
  for (const validate of [assessScientificClaim, validateScientificExperiment]) {
    let lengthReads = 0;
    const observations = new Proxy([{expected:1, actual:1, expectedUnit:'m', actualUnit:'m'}], {
      get(target, key, receiver) {
        if (key === 'length') {
          lengthReads++;
          return lengthReads === 1 ? target.length : 0;
        }
        return Reflect.get(target, key, receiver);
      },
    });
    assert.throws(() => validate({...claim, observations}), {message:'Invalid observations'});
    assert.equal(lengthReads, 0);
  }
});
