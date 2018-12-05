'use strict';

const chai = require('chai');
const assert = chai.assert;
const PercentileBuckets = require('../src/percentile_buckets');

describe('Percentile Buckets', () => {
  it('should get the right index', () => {
    assert.equal(PercentileBuckets.indexOf(-1), 0);
    for (let i = 0; i <= 4; ++i) {
      assert.equal(PercentileBuckets.indexOf(i), i);
    }
    assert.equal(16, PercentileBuckets.indexOf(21));
    assert.equal(18, PercentileBuckets.indexOf(31));
    assert.equal(25, PercentileBuckets.indexOf(87));
    assert.equal(41, PercentileBuckets.indexOf(1020));
    assert.equal(55, PercentileBuckets.indexOf(10000));
    assert.equal(70, PercentileBuckets.indexOf(100000));
    assert.equal(86, PercentileBuckets.indexOf(1e6));
    assert.equal(100, PercentileBuckets.indexOf(1e7));
    assert.equal(115, PercentileBuckets.indexOf(1e8));
    assert.equal(131, PercentileBuckets.indexOf(1e9));
    assert.equal(144, PercentileBuckets.indexOf(1e10));
    assert.equal(160, PercentileBuckets.indexOf(1e11));
    assert.equal(175, PercentileBuckets.indexOf(1e12));

    // assert.equal(PercentileBuckets.length() - 1,
    //   PercentileBuckets.indexOf(Math.pow(2, 63)));
  });

  it('should compute sane bucket values', () => {
    function getNumber() {
      const Max = 1e14; // 10000s
      return Math.floor(Math.random() * Max);
    }

    for (let i = 0; i < 10000; ++i) {
      const n = getNumber();
      const b = PercentileBuckets.bucket(n);
      assert.isAtMost(n, b);
    }
  });

  it('calculate percentiles', () => {
    const counts = new Array(PercentileBuckets.length());
    for (let i = 0; i < counts.length; ++i) {
      counts[i] = 0;
    }

    for (let i = 0; i < 100000; ++i) {
      ++counts[PercentileBuckets.indexOf(i)];
    }

    const pcts = [0.0,  25.0, 50.0, 75.0, 90.0, 95.0, 98.0, 99.0, 99.5, 100.0];
    const expected = [0.0,  25e3, 50e3, 75e3,   90e3,
      95e3, 98e3, 99e3, 99.5e3, 100e3];
    const results = PercentileBuckets.percentiles(counts, pcts);
    for (let i = 0; i < results.length; ++i) {
      const threshold = 0.1 * expected[i];
      assert.isAtMost(Math.abs(expected[i] - results[i]), threshold);
    }
  });

});
