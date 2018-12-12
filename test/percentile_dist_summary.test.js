'use strict';

const chai = require('chai');
const assert = chai.assert;
const Registry = require('../src/registry');
const PercentileDistributionSummary = require('../src/percentile_dist_summary');

describe('Percentile Distribution Summaries', () => {
  function checkPercentiles(ds, start) {
    const N = 100000;
    for (let i = 0; i < N; ++i) {
      ds.record(i);
    }
    assert.equal(ds.count, N);

    for (let i = start; i <= 100; ++i) {
      const expected = i * 1000;
      const threshold = 0.15 * expected;
      const actual = ds.percentile(i);
      assert.isAtMost(Math.abs(expected - actual), threshold,
        `Expected ${i}th percentile to be near ${expected} but got ${actual} instead`);
    }
  }

  it('constructor', () => {
    const r = new Registry();
    const ds = PercentileDistributionSummary.get(r, r.newId('p'));
    checkPercentiles(ds, 0);
  });

  it('builder', () => {
    const r = new Registry();
    const ds = new PercentileDistributionSummary.Builder(r).withName('foo').build();
    checkPercentiles(ds, 0);
  });

  it('builder with threshold', () => {
    const r = new Registry();
    const ds = new PercentileDistributionSummary.Builder(r).withName('foo')
      .withRange(25 * 1000, 100 * 1000).build();
    checkPercentiles(ds, 25);
  });

  it('builder with id', () => {
    const r = new Registry();
    const ds = new PercentileDistributionSummary.Builder(r)
      .withId(r.newId('name', {k: 'v'})).build();
    assert.equal(ds.id.key, 'name|k=v');
  });

  it('builder with name/tags', () => {
    const r = new Registry();
    const ds = new PercentileDistributionSummary.Builder(r)
      .withName('name').withTags({k: 'v'}).build();
    assert.equal(ds.id.key, 'name|k=v');
  });

  it('count and totalAmount', () => {
    const N = 10000;

    // in milliseconds
    const expectedSum = N * (N - 1) / 2;

    const r = new Registry();
    const ds = new PercentileDistributionSummary.Builder(r).withName('foo').build();
    for (let i = 0; i < N; ++i) {
      ds.record(i);
    }

    // totalAmount returns correct sum
    assert.equal(ds.totalAmount, expectedSum);
    assert.equal(ds.count, N);

    // get the total count for the percentiles
    function totalCount() {
      return r.meters().filter(m => m.id.tags.has('percentile')).reduce((sum, m) => sum + m.count, 0);
    }
    assert.equal(totalCount(), N);

    // ignores negative updates
    ds.record(-1);
    assert.equal(ds.count, N);
    assert.equal(totalCount(), N);
  });
});
