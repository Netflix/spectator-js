'use strict';

const chai = require('chai');
const assert = chai.assert;
const Registry = require('../src/registry');
const PercentileTimer = require('../src/percentile_timer');

describe('Percentile Timers', () => {
  function millisToNanos(millis) {
    return millis * 1e6;
  }

  function checkPercentiles(timer, start) {
    const N = 100000;
    for (let i = 0; i < N; ++i) {
      timer.record(0, millisToNanos(i));
    }
    assert.equal(timer.count, N);

    for (let i = start; i <= 100; ++i) {
      const expected = i;
      const threshold = 0.15 * expected;
      const actual = timer.percentile(i);
      assert.isAtMost(Math.abs(expected - actual), threshold,
        `Expected ${i}th percentile to be near ${expected} but got ${actual} instead`);
    }
  }

  it('basic use', () => {
    const r = new Registry();
    const id = r.createId('p');
    const t = new PercentileTimer(r, id);
    checkPercentiles(t, 0);
  });

  it('builder with range', () => {
    const r = new Registry();
    const t = new PercentileTimer.Builder(r).withName('foo')
      .withRangeSeconds(10, 100).build();
    checkPercentiles(t, 10);
  });

  it('builder with threshold', () => {
    const r = new Registry();
    const t = new PercentileTimer.Builder(r).withName('foo')
      .withRangeMilliseconds(0, 100 * 1000).build();
    checkPercentiles(t, 0);
  });

  it('builder with nanos', () => {
    const r = new Registry();
    // 5ms to 100s
    const t = new PercentileTimer.Builder(r).withName('foo')
      .withRangeNanoseconds(5 * 1e6, 100 * 1e9).build();
    checkPercentiles(t, 5);
  });

  it('builder with id', () => {
    const r = new Registry();
    const t = new PercentileTimer.Builder(r).withId(r.createId('name', {k: 'v'})).build();
    assert.equal(t.id.key, 'name|k=v');
  });

  it('builder with name/tags', () => {
    const r = new Registry();
    const t = new PercentileTimer.Builder(r).withName('name').withTags({k: 'v'}).build();
    assert.equal(t.id.key, 'name|k=v');
  });

  it('count and totalTime', () => {
    const N = 10000;

    // in milliseconds
    const expectedSum = N * (N - 1) / 2;

    const r = new Registry();
    const timer = PercentileTimer.get(r, r.createId('name'));
    for (let i = 0; i < N; ++i) {
      timer.record([0, millisToNanos(i)]);
    }

    // totalTime returns nanos
    assert.equal(timer.totalTime, expectedSum * 1e6);
    assert.equal(timer.count, N);

    // get the total count for the percentiles
    function totalCount() {
      return r.meters().filter(m => m.id.tags.has('percentile')).reduce((sum, m) => sum + m.count, 0);
    }
    assert.equal(totalCount(), N);

    // ignores negative updates
    timer.record([-1, 0]);
    assert.equal(timer.count, N);
    assert.equal(totalCount(), N);
    timer.record(0, -1);
    assert.equal(timer.count, N);
    assert.equal(totalCount(), N);
  });
});
