'use strict';

const chai = require('chai');
const assert = chai.assert;
const Registry = require('../src/registry');
const BucketFunctions = require('../src/bucket_functions');
const BucketDistributionSummary = require('../src/bucket_dist_summary');

describe('Bucket Distribution Summary', () => {
  function filter(meters, name)  {
    return meters.filter(m => m.id.name === name);
  }

  function sum(distSummaries) {
    return distSummaries.reduce((sum, m) => sum + m.count, 0);
  }

  it('basic operations', () => {
    const r = new Registry();
    const c = new BucketDistributionSummary(r, r.newId('test'), BucketFunctions.latency(4, 's'));

    c.record(3750 * 1e6);
    let meters = filter(r.meters(), 'test');
    assert.lengthOf(meters, 1);
    assert.equal(sum(meters), 1);
    assert.equal(meters[0].id.tags.get('bucket'), '4000ms');

    c.record(4221 * 1e6);
    meters = filter(r.meters(), 'test');
    assert.lengthOf(meters, 2);
    assert.equal(sum(meters), 2);

    c.record(3700 * 1e6);
    meters = filter(r.meters(), 'test');
    assert.lengthOf(meters, 2);
    assert.equal(sum(meters), 3);
  });
});
