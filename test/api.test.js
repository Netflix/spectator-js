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
});
