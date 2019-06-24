'use strict';

const chai = require('chai');
const assert = chai.assert;
const IntervalCounter = require('../src/interval_counter');
const Registry = require('../src/registry');

describe('IntervalCounter', () => {
  it('measurements', (done) => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: true});
    r.hrtime = (time) => {
      if (time) {
        return [0, 10e6]; // return duration = 10ms
      }
      return [0, 123];
    };

    const counter = IntervalCounter.get(r, r.createId('ic'));
    counter.add(5);
    assert.equal(counter.count, 5);

    setTimeout(() => {
      const ms = r.measurements();
      assert.lengthOf(ms, 2);
      for (let m of ms) {
        assert.equal(m.id.name, 'ic');
        const stat = m.id.tags.get('statistic');
        if (stat === 'count') {
          assert.equal(m.v, 5);
        } else if (stat === 'duration') {
          assert.equal(m.v, 0.01);
        } else {
          assert.fail('Unexpected meter. Only statistic=duration and count were ' +
            `expected but got '${stat}' instead`);
        }
      }
      r.stop();
      assert.equal(counter.secondsSinceLastUpdate, 0.01);
      done();
    }, 3);
  });

  it('provides increment', () => {
    const r = new Registry({});
    const counter = IntervalCounter.get(r, r.createId('ic'));
    counter.increment();
    assert.equal(counter.count, 1);

    counter.increment(1.1);
    assert.equal(counter.count, 2.1);
  });

  it('multiple calls to get', (done) => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: true});
    r.hrtime = (time) => {
      if (time) {
        return [0, 20e6]; // return duration = 20ms
      }
      return [0, 123];
    };
    const counter = IntervalCounter.get(r, r.createId('ic'));
    const counter2 = IntervalCounter.get(r, r.createId('ic'));
    // both should refer to the same counter
    counter.add(1);

    setTimeout(() => {
      const ms = r.measurements();
      assert.lengthOf(ms, 2);
      for (let m of ms) {
        assert.equal(m.id.name, 'ic');
        const stat = m.id.tags.get('statistic');
        if (stat === 'count') {
          assert.equal(m.v, 1);
        } else if (stat === 'duration') {
          assert.equal(m.v, 0.02);
        } else {
          assert.fail('Unexpected meter. Only statistic=duration and count were ' +
            `expected but got '${stat}' instead`);
        }
      }
      r.stop();
      assert.equal(counter2.secondsSinceLastUpdate, 0.02);
      done();
    }, 3);
  });

  it('throws when reusing an id previously registered as a different type', () => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: true});
    const basicCounter = r.counter('ic');

    assert.throws(() => IntervalCounter.get(r, r.createId('ic')),
      /found a Counter but was expecting an IntervalCounter/);
    basicCounter.add(2);

    // didn't affect the registry
    assert.equal(r.counter('ic').count, 2);
    r.stop();
  });

  it('protects against the key used in the state map being used for other purposes', () => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: true});
    const id = r.createId('ic');
    r.state.set(id.key, 'Foo');
    assert.throws(() => IntervalCounter.get(r, id),
      /found a String but was expecting an IntervalCounter/);
    r.stop();
  });

  it('logs an error when not running under strictMode', () => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: false});
    r.timer('ic');
    r.state.set('ic2', 'foo');

    let errorCount = 0;
    r.logger.error = (msg) => {
      ++errorCount;
      console.log(`ERROR: ${msg}`);
    };

    const id = r.createId('ic');
    IntervalCounter.get(r, id);

    const id2 = r.createId('ic2');
    IntervalCounter.get(r, id2);
    assert.equal(errorCount, 2);

    r.stop();
  });
});
