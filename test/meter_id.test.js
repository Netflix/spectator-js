'use strict';

const chai = require('chai');
const assert = chai.assert;

const MeterId = require('../src/meter_id');

describe('MeterIds', () => {
  it('should create ids with tags from maps and objects', () => {
    const id = new MeterId('name', {k: 'v', k2: 'v2'});
    const id2 = new MeterId('name', new Map([['k', 'v'], ['k2', 'v2']]));
    assert.equal(id.key, id2.key); // this forces a serialization of all the tags
  });

  it('should add empty tags by default', () => {
    const id = new MeterId('name');
    const id2 = new MeterId('name', {});

    assert.equal(id.key, id2.key);
  });

  it('should create new ones adding tags', () => {
    const id = new MeterId('name');
    const id2 = id.withTag('status', 'ok').withTag('error', 'none');

    assert.equal(id.name, id2.name);
    assert.equal(id.tags.size, 0); // make sure we didn't modify the original
    assert.equal(id2.tags.size, 2);
  });

  it('should add all tags from maps and objects', () => {
    const id = new MeterId('name', {k: 'v'});
    const id2 = id.withTags({k2: 'v2', k3: 'v3'});
    const id3 = id2.withTags(new Map([['k4', 'v4'], ['k5', 'v5']]));
    const id4 = id.withTags(undefined);

    assert.equal(id.key, 'name|k=v');
    assert.equal(id2.key, 'name|k=v|k2=v2|k3=v3');
    assert.equal(id3.key, 'name|k=v|k2=v2|k3=v3|k4=v4|k5=v5');
    assert.equal(id.key, id4.key);
  });

  it('should handle repeated calls to get its key', () => {
    const id = new MeterId('name', {k: 'v'});
    assert.equal(id.key, 'name|k=v');
    // subsequent calls are cached, so make sure it still works
    assert.equal(id.key, 'name|k=v');
    assert.equal(id.key, 'name|k=v');
    assert.equal(id.key, 'name|k=v');
  });

  it('should preserve statistic if present', () => {
    const id = new MeterId('name', {statistic: 'percentile'});
    assert.equal(id.withDefaultStat('counter').tags.get('statistic'), 'percentile');
  });

});
