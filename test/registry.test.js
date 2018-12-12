'use strict';

const chai = require('chai');
const assert = chai.assert;

const AtlasRegistry = require('../src/registry');
const MeterId = require('../src/meter_id');

function newRegistry() {
  const c = {
    strictMode: true,
    commonTags: {
      'nf.node': 'i-12345',
      'nf.cluster': 'app-main',
      'nf.app': 'app'
    }
  };
  return new AtlasRegistry(c);
}

describe('AtlasRegistry', () => {
  it('measurements', () => {
    const r = newRegistry();
    r.counter('c').increment();
    r.counter('d');
    r.gauge('f').set(10.0);
    r.gauge('g');

    const ms = r.measurements();
    ms.sort((a, b) => {
      if (a.id.name < b.id.name) {
        return -1;
      } else if (a.id.name > b.id.name) {
        return 1;
      }
      return 0;
    });

    const cId = new MeterId('c', {statistic: 'count'});
    const fId = new MeterId('f', {statistic: 'gauge'});

    const expected = [
      {id: cId, v: 1},
      {id: fId, v: 10.0}
    ];
    assert.deepEqual(ms, expected);
  });

  it('should only start if a publish uri is provided', () => {
    const r = newRegistry();
    assert.isFalse(r.shouldStart());

    const r2 = new AtlasRegistry({uri: 'http://localhost/foo'});
    assert.isTrue(r2.shouldStart());

    r2.start();
    assert.isFalse(r2.shouldStart()); // already started

    r2.stop();
    assert.isTrue(r2.shouldStart()); // start after stop is ok

    r.start(); // should be a nop
    assert.isFalse(r.started);
  });

  it('should handle common tags as Object or map', () => {
    const cfgObject = { commonTags: {k1: 'v1', k2: 'v2'}};
    const rObj = new AtlasRegistry(cfgObject);
    assert.equal(rObj.commonTags.size, 2);

    const cfgMap = { commonTags: new Map([['k1', 'v1'], ['k2', 'v2']]) };
    const rMap = new AtlasRegistry(cfgMap);
    assert.equal(rMap.commonTags.size, 2);
  });

  it('should ignore meters with unknown stats', () => {
    const r = newRegistry();
    r.counter('ctr').increment();
    assert.lengthOf(r.publisher.registryMeasurements(), 1);

    r.counter('hack.ctr').increment();
    r.gauge('hack.gauge').set(42);
    r.counter('ctr').increment();
    r.gauge('gauge').set(42);

    // hack registry.measurements() so it changes the statistic tag
    const origMeasurements = r.measurements;
    r.measurements = function() {
      const ms = origMeasurements.call(r);
      const newMeasurements = [];

      for (let m of ms) {
        if (m.id.name === 'hack.ctr') {
          // unknown statistic
          m.id = r.newId('hack.ctr', {statistic: 'foo'});
        } else if (m.id.name === 'hack.gauge') {
          // remove statistic
          m.id = r.newId('hack.gauge');
        }
        newMeasurements.push(m);
      }
      return newMeasurements;
    };
    const ms = r.publisher.registryMeasurements();
    assert.lengthOf(ms, 2);
  });

  it('publisher should build a string table', () => {
    const r = newRegistry();
    const p = r.publisher;
    const id1 = new MeterId('name1', {statistic: 'max', k: 'v1'});
    const id2 = new MeterId('name2', {statistic: 'count', k: 'v2'});
    let measurements = [{id: id1, v: 1.0}, {id: id2, v: 0.1}];
    const strTable = p.buildStringTable(measurements);
    const expected = {
      app: 0,
      'app-main': 1,
      count: 2,
      'i-12345': 3,
      k: 4,
      max: 5,
      name: 6,
      name1: 7,
      name2: 8,
      'nf.app': 9,
      'nf.cluster': 10,
      'nf.node': 11,
      statistic: 12,
      v1: 13,
      v2: 14
    };
    assert.deepEqual(strTable, expected);
  });


  function getEntry(strings, payload, base) {
    const numTags = payload[base];
    const tags = {};

    for (let i = base + 1; i < base + numTags * 2; i += 2) {
      const keyIdx = payload[i];
      const valIdx = payload[i + 1];
      tags[strings[keyIdx]] = strings[valIdx];
    }
    const op = payload[base + numTags * 2 + 1];
    const val = payload[base + numTags * 2 + 2];
    const numConsumed = numTags * 2 + 3;
    return [numConsumed, {tags: tags, op: op, v: val}];
  }

  function payloadToEntries(payload) {
    const numStrings = payload[0];
    const strings = new Array(numStrings);

    for (let i = 1; i <= numStrings; ++i) {
      strings[i - 1] = payload[i];
    }

    const entries = [];
    let curIdx = numStrings + 1;

    while (curIdx < payload.length) {
      let res = getEntry(strings, payload, curIdx);
      const numConsumed = res[0];

      if (numConsumed === 0) {
        assert.fail('Could not decode payload. Last index ' + curIdx);
      }
      curIdx += numConsumed;
      entries.push(res[1]);
    }

    return entries;
  }

  it('publisher should convert measurements to a payload', () => {
    const r = newRegistry();
    const p = r.publisher;
    const id1 = new MeterId('name1', {statistic: 'max', k: 'v1'});
    const id2 = new MeterId('name2', {statistic: 'count', k: 'v2'});
    const measurements = [{id: id1, v: 42.0}, {id: id2, v: 0.1}];
    const payload = p.payloadForMeasurements(measurements);

    const entries = payloadToEntries(payload);
    const e1 = {
      tags: Object.assign({}, r.config.commonTags),
      op: 10,
      v: 42
    };
    e1.tags.name = 'name1';
    e1.tags.statistic = 'max';
    e1.tags.k = 'v1';

    const e2 = {
      tags: Object.assign({}, r.config.commonTags),
      op: 0,
      v: 0.1
    };
    e2.tags.name = 'name2';
    e2.tags.statistic = 'count';
    e2.tags.k = 'v2';
    assert.deepEqual(entries, [e1, e2]);
  });

  it('should gather and send measurements from meters', () => {
    const config = {};
    config.commonTags = { 'nf.node': 'i-1234'};
    config.uri = 'http://localhost:8080/publish';

    const r = new AtlasRegistry(config);
    r.counter('ctr').increment();
    r.timer('tmr').record(2, 0);
    r.timer('tmr').record(4, 0);

    r.publisher.http.postJson = function(uri, payload) {
      assert.equal(uri, config.uri);

      const entries = payloadToEntries(payload);
      const c = {
        tags: {
          'nf.node': 'i-1234',
          statistic: 'count',
          name: 'ctr'
        },
        op: 0,
        v: 1
      };
      const tmrCount = {
        tags: {
          'nf.node': 'i-1234',
          statistic: 'count',
          name: 'tmr'
        },
        op: 0,
        v: 2
      };
      const tmrTotal = {
        tags: {
          'nf.node': 'i-1234',
          statistic: 'totalTime',
          name: 'tmr'
        },
        op: 0,
        v:6
      };
      const tmrTotalSq = {
        tags: {
          'nf.node': 'i-1234',
          statistic: 'totalOfSquares',
          name: 'tmr'
        },
        op: 0,
        v: 20
      };
      const tmrMax = {
        tags: {
          'nf.node': 'i-1234',
          statistic: 'max',
          name: 'tmr'
        },
        op: 10,
        v: 4
      };
      assert.deepEqual(entries, [c, tmrCount, tmrTotal, tmrTotalSq, tmrMax]);
    };
    r.publish(r);
  });
});
