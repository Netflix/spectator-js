'use strict';

const chai = require('chai');
const assert = chai.assert;
const Counter = require('../src/Counter');
const MeterId = require('../src/meter_id');

describe('Counters', () => {
  it('should record values', () => {
    const id = new MeterId('c');
    const counter = new Counter(id);

    // quick sanity check
    assert.equal(counter.count, 0);

    counter.add(100);
    assert.equal(counter.count, 100);

    // 0 counts towards total number of events
    counter.increment();
    assert.equal(counter.count, 101);

    counter.increment(101);
    assert.equal(counter.count, 202);

    // ignores negative values
    counter.add(-1);
    assert.equal(counter.count, 202);
  });

  it('should report proper measurements', () => {
    const id = new MeterId('c');
    const counter = new Counter(id);
    assert.lengthOf(counter.measure(), 0);

    counter.add(2);
    counter.increment();
    const ms = counter.measure();
    assert.lengthOf(counter.measure(), 0); // resets
    assert.deepEqual([{id: id.withStat('count'), v: 3}], ms);
  });
});
