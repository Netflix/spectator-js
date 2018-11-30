'use strict';

const chai = require('chai');
const assert = chai.assert;
const Timer = require('../src/timer');
const MeterId = require('../src/meter_id');

describe('Timers', () => {
  it('should record values', () => {
    const id = new MeterId('t');
    const t = new Timer(id);

    // quick sanity check
    assert.equal(t.count, 0);
    assert.equal(t.totalTime, 0);

    t.record(100);
    assert.equal(t.count, 1);
    assert.equal(t.totalTime, 100 * 1e9);

    // 0 counts towards total number of events
    t.record(0);
    assert.equal(t.count, 2);
    assert.equal(t.totalTime, 100 * 1e9);

    t.record(101);
    assert.equal(t.count, 3);
    assert.equal(t.totalTime, 201 * 1e9);

    // ignores negative values
    t.record(-1);
    assert.equal(t.count, 3);
    assert.equal(t.totalTime, 201 * 1e9);
  });

  function assertTimer(timer, count, total, totalSq, max) {
    const ms = timer.measure();
    assert.equal(ms.length, 4, 'Timers should report 4 values');
    const id = timer.id;
    const expected = {};
    expected[id.withStat('count').key] = count;
    expected[id.withStat('totalTime').key] = total;
    expected[id.withStat('totalOfSquares').key] = totalSq;
    expected[id.withStat('max').key] = max;

    const actual = {};

    for (let m of ms) {
      actual[m.id.key] = m.v;
    }
    assert.deepEqual(actual, expected);

    // resets after being measured
    assert.equal(timer.measure().length, 0);
  }

  it('should report proper measurements', () => {
    const id = new MeterId('ds');
    const timer = new Timer(id);
    assert.equal(timer.measure().length, 0);

    timer.record([1,0]);
    timer.record([0,1e8]);
    assertTimer(timer, 2, 1.1, 1 + 0.1 * 0.1, 1);
  });
});
