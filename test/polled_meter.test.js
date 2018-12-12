'use strict';

const chai = require('chai');
const assert = chai.assert;
const PolledMeter = require('../src/polled_meter');
const Registry = require('../src/registry');

describe('PolledMeter', () => {
  it('monitorValue using name/tags', (done) => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: true});
    let i = 1;
    PolledMeter.using(r).withName('polledMeter').withTags(
      {foo: 'bar'}).monitorValue(() => i + 1);

    setTimeout(() => {
      const ms = r.meters();
      assert.lengthOf(ms, 1);
      assert.equal(ms[0].get(), 2);
      r.stop();
      done();
    }, 2);
  });

  it('monitorValue using id', (done) => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: true});
    const id = r.newId('foo');
    let x = 1;
    PolledMeter.using(r).withId(id).monitorValue(() => x);
    x = 42;

    setTimeout(() => {
      const ms = r.meters();
      assert.lengthOf(ms, 1);
      assert.equal(ms[0].get(), 42);
      r.stop();
      done();
    }, 2);
  });

  it('monitorValue using multiple functions', (done) => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: true});
    const id = r.newId('foo');
    let x = 1;
    PolledMeter.using(r).withId(id).monitorValue(() => x);
    PolledMeter.using(r).withId(id).monitorValue(() => x + 1);
    x = 42;

    setTimeout(() => {
      const ms = r.meters();
      assert.lengthOf(ms, 1);
      assert.equal(ms[0].get(), 42 + 43);
      r.stop();
      done();
    }, 2);
  });

  it('monotonic counters using name/tags', (done) => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: true});

    let x = 100;
    PolledMeter.using(r).withName('foo').withTags({k:'v'}).monitorMonotonicNumber(() => x);

    let y = 200;
    PolledMeter.using(r).withName('foo').withTags({k:'v'}).monitorMonotonicNumber(() => y);

    x = 142;
    y = 201;

    setTimeout(() => {
      const ms = r.meters();
      assert.lengthOf(ms, 1);
      assert.equal(ms[0].count, 43);
      r.stop();
      done();
    }, 2);
  });

  it('throws when mixing polled meters', () => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: true});
    const id = r.newId('foo');

    let x = 100;
    PolledMeter.using(r).withId(id).monitorMonotonicNumber(() => x);

    assert.throws( () =>
      PolledMeter.using(r).withId(id).monitorValue(() => x),
      /Expecting a different type/);

    const id2 = id.withTag('k', 'v');
    PolledMeter.using(r).withId(id2).monitorValue(() => x);
    assert.throws( () =>
        PolledMeter.using(r).withId(id2).monitorMonotonicNumber(() => x),
      /Expecting a different type/);

    r.stop();
  });

  it('just logs errors when mixing polled meters (non-strict)', () => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: false});

    let errorCount = 0;
    r.logger.error = (msg) => {
      console.log(`INFO: ${msg}`);
      errorCount++;
    };

    const id = r.newId('foo');
    let x = 100;
    PolledMeter.using(r).withId(id).monitorMonotonicNumber(() => x);
    assert.equal(errorCount, 0);

    PolledMeter.using(r).withId(id).monitorValue(() => x);
    assert.equal(errorCount, 2);

    const id2 = id.withTag('k', 'v');
    PolledMeter.using(r).withId(id2).monitorValue(() => x);
    assert.equal(errorCount, 2);

    PolledMeter.using(r).withId(id2).monitorMonotonicNumber(() => x);
    assert.equal(errorCount, 4);

    r.stop();
  });
});
