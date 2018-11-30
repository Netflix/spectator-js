'use strict';

const chai = require('chai');
const assert = chai.assert;
const DistributionSummary = require('../src/dist_summary');
const MeterId = require('../src/meter_id');

describe('Distribution summaries', () => {
  it('should record values', () => {
    const id = new MeterId('ds');
    const ds = new DistributionSummary(id);

    // quick sanity check
    assert.equal(ds.count, 0);
    assert.equal(ds.totalAmount, 0);

    ds.record(100);
    assert.equal(ds.count, 1);
    assert.equal(ds.totalAmount, 100);

    // 0 counts towards total number of events
    ds.record(0);
    assert.equal(ds.count, 2);
    assert.equal(ds.totalAmount, 100);

    ds.record(101);
    assert.equal(ds.count, 3);
    assert.equal(ds.totalAmount, 201);

    // ignores negative values
    ds.record(-1);
    assert.equal(ds.count, 3);
    assert.equal(ds.totalAmount, 201);
  });

  function assertDs(ds, count, total, totalSq, max) {
    const ms = ds.measure();
    assert.equal(ms.length, 4, 'Dist summaries should report 4 values');
    const id = ds.id;
    const expected = {};
    expected[id.withStat('count').key] = count;
    expected[id.withStat('totalAmount').key] = total;
    expected[id.withStat('totalOfSquares').key] = totalSq;
    expected[id.withStat('max').key] = max;

    const actual = {};

    for (let m of ms) {
      actual[m.id.key] = m.v;
    }
    assert.deepEqual(actual, expected);

    // resets after being measured
    assert.equal(ds.measure().length, 0);
  }

  it('should report proper measurements', () => {
    const id = new MeterId('ds');
    const ds = new DistributionSummary(id);
    assert.equal(ds.measure().length, 0);

    ds.record(100);
    ds.record(200);
    assertDs(ds, 2, 300, 100 * 100 + 200 * 200, 200);
  });
});
