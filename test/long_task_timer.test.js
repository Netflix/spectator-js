'use strict';

const chai = require('chai');
const assert = chai.assert;
const LongTaskTimer = require('../src/long_task_timer');
const Registry = require('../src/registry');

describe('LongTaskTimer', () => {
  it('measurements', (done) => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: true});
    const timer = LongTaskTimer.get(r, r.newId('ltt'));
    const task = timer.start();

    setTimeout(() => {
      const ms = r.measurements();
      assert.lengthOf(ms, 2);
      const measurements = {};
      for (let m of ms) {
        assert.equal(m.id.name, 'ltt');
        const stat = m.id.tags.get('statistic');
        if (stat === 'activeTasks') {
          assert.equal(m.v, 1);
        } else if (stat === 'duration') {
          assert.isAtLeast(m.v, 0.001);
        } else {
          assert.fail('Unexpected meter. Only statistic=activeTasks and duration were ' +
            `expected but got '${stat}' instead`);
        }
        measurements[stat] = m.v;
      }
      r.stop();
      assert.isAtLeast(timer.stop(task), 0.001);
      done();
    }, 3);
  });

  it('multiple calls to get', (done) => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: true});
    const timer = LongTaskTimer.get(r, r.newId('ltt'));
    const timer2 = LongTaskTimer.get(r, r.newId('ltt'));
    // both should refer to the same timer
    const task = timer.start();

    setTimeout(() => {
      const ms = r.measurements();
      assert.lengthOf(ms, 2);
      const measurements = {};
      for (let m of ms) {
        assert.equal(m.id.name, 'ltt');
        const stat = m.id.tags.get('statistic');
        if (stat === 'activeTasks') {
          assert.equal(m.v, 1);
        } else if (stat === 'duration') {
          assert.isAtLeast(m.v, 0.001);
        } else {
          assert.fail('Unexpected meter. Only statistic=activeTasks and duration were ' +
            `expected but got '${stat}' instead`);
        }
        measurements[stat] = m.v;
      }
      r.stop();
      assert.isAtLeast(timer2.stop(task), 0.001);
      done();
    }, 3);
  });

  it('throws when reusing an id previously registered as a different type', () => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: true});
    const basicTimer = r.timer('ltt');

    assert.throws(() => LongTaskTimer.get(r, r.newId('ltt')),
      /found a Timer but was expecting a LongTaskTimer/);
    basicTimer.record(2, 0);

    // didn't affect the registry
    assert.equal(r.timer('ltt').count, 1);
    r.stop();
  });

  it('protects against the key used in the state map being used for other purposes', () => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: true});
    const id = r.newId('ltt');
    r.state.set(id.key, 'Foo');
    assert.throws(() => LongTaskTimer.get(r, id),
      /found a String but was expecting a LongTaskTimer/);
    r.stop();
  });

  it('logs an error when not running under strictMode', () => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: false});
    r.timer('ltt');
    r.state.set('ltt2', 'foo');

    let errorCount = 0;
    r.logger.error = (msg) => {
      ++errorCount;
      console.log(`ERROR: ${msg}`);
    };

    const id = r.newId('ltt');
    const t = LongTaskTimer.get(r, id);
    t.start();
    t.start();
    assert.equal(t.activeTasks, 2);
    assert.equal(errorCount, 1);


    const id2 = r.newId('ltt2');
    LongTaskTimer.get(r, id2);
    assert.equal(errorCount, 2);

    r.stop();
  });

  it('negative duration when stopping a non-existent task', () => {
    const r = new Registry({gaugePollingFrequency: 1, strictMode: false});
    const t = LongTaskTimer.get(r, r.newId('ltt'));
    const taskId = t.start();
    assert.isBelow(t.stop(taskId + 1), 0);
    r.stop();
  });
});