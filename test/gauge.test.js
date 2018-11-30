'use strict';

const chai = require('chai');
const assert = chai.assert;
const Gauge = require('../src/gauge');
const MeterId = require('../src/meter_id');

describe('Gauges', () => {
  it('should init gauges to NaN', () => {
    const id = new MeterId('g');
    const g = new Gauge(id);
    assert.isNaN(g.get());
  });

  it('should set values', () => {
    const id = new MeterId('g');
    const g = new Gauge(id);
    g.set(42);
    assert.equal(g.get(), 42);

    g.set(21);
    assert.equal(g.get(), 21);
  });

  it('should report proper measurements', () => {
    const id = new MeterId('g');
    const gauge = new Gauge(id);
    assert.lengthOf(gauge.measure(), 0);

    gauge.set(2);
    const ms = gauge.measure();
    assert.lengthOf(gauge.measure(), 0); // resets
    assert.deepEqual([{id: id.withStat('gauge'), v: 2}], ms);
  });
});
