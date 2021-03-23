'use strict';

const Registry = require('../').Registry;
const chai = require('chai');
const assert = chai.assert;

describe('spectator registry', () => {
  it('should provide counters', () => {
    const registry = new Registry();
    const counter = registry.counter('foo');
    counter.increment();
    const counterWithTag = registry.counter('foo', {
      k: 'v2'
    });

    counterWithTag.add(2);
    assert.equal(registry.counter('foo').count, 1);
    assert.equal(registry.counter('foo', {k: 'v2'}).count, 2);
  });

  it('should provide timers', () => {
    const registry = new Registry();
    const timer = registry.timer('timer');
    timer.record(1);
    const timerT = registry.timer('timer', {k: 'v2'});
    timerT.record(2);
    timerT.record(3);

    assert.equal(registry.timer('timer').count, 1);
    assert.equal(registry.timer('timer', {k: 'v2'}).count, 2);
  });

  it('should provide distribution summaries', () => {
    const registry = new Registry();
    const ds = registry.distributionSummary('ds');
    ds.record(1000);

    const dsT = registry.distributionSummary('ds', {k: 'v2'});
    dsT.record(1000);
    dsT.record(2000);

    assert.equal(registry.distributionSummary('ds').totalAmount, 1000);
    assert.equal(registry.distributionSummary('ds', {k: 'v2'}).totalAmount, 3000);
  });

  it('should provide gauges', () => {
    const registry = new Registry();
    const g = registry.gauge('g');
    g.set(42);
    const gT = registry.gauge('g', {k: 'v'});
    gT.set(1);

    assert.equal(registry.gauge('g').get(), 42);
    assert.equal(registry.gauge('g', {k: 'v'}).get(), 1);
  });

  it('should provide interval counters', () => {
    const registry = new Registry();
    registry.hrtime = () => {
      return [0, 100];
    };

    const t = registry.intervalCounter('foo');
    t.add(100);
    assert.equal(registry.intervalCounter('foo').count, 100);
    registry.hrtime = (prev) => {
      assert.deepEqual(prev, [0, 100]);
      return [42, 0];
    };
    assert.equal(t.secondsSinceLastUpdate, 42);
  });

  it('should provide percentile timers', () => {
    const registry = new Registry();
    const t = registry.percentileTimer('foo');
    t.record([0, 1000]);
    assert.equal(t.count, 1);
    assert.equal(t.totalTime, 1000);

    // Updating t2 should have an effect on t
    const t2 = registry.percentileTimer('foo');
    t2.record([0, 2000]);

    assert.equal(t.count, 2);
    assert.equal(t.totalTime, 3000);
  });

  it('should provide percentile dist summaries', () => {
    const registry = new Registry();
    const ds = registry.percentileDistSummary('foo');
    ds.record(42);
    assert.equal(ds.count, 1);
    assert.equal(ds.totalAmount, 42);

    // Updating t2 should have an effect on t
    const ds2 = registry.percentileDistSummary('foo');
    ds2.record(58);

    assert.equal(ds.count, 2);
    assert.equal(ds.totalAmount, 100);
  });

  function dummyBucketFun(amount) {
    if (amount > 100) {
      return 'large';
    } else if (amount < 20) {
      return 'small';
    }
    return 'medium';
  }

  it('should provide bucket counters', () => {
    const registry = new Registry();
    const t = registry.bucketCounter('foo', dummyBucketFun);
    t.record(10);
    // this should have created a timer with a tag value bucket=medium
    assert.equal(registry.counter('foo', {bucket: 'small'}).count, 1);
  });

  it('should provide bucket timers', () => {
    const registry = new Registry();
    const t = registry.bucketTimer('foo', dummyBucketFun);
    t.record([0, 30]);
    // this should have created a timer with a tag value bucket=medium
    assert.equal(registry.timer('foo', {bucket: 'medium'}).count, 1);
  });

  it('should provide bucket distribution summaries', () => {
    const registry = new Registry();
    const t = registry.bucketDistSummary('foo', dummyBucketFun);
    t.record(200);
    // this should have created a timer with a tag value bucket=medium
    assert.equal(registry.distributionSummary('foo', {bucket: 'large'}).count, 1);
  });
});
