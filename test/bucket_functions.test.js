'use strict';

const chai = require('chai');
const assert = chai.assert;
const BucketFunctions = require('../src/bucket_functions');

function secondsToNanos(s) {
  return s * 1e9;
}

function millisToNanos(ms) {
  return ms * 1e6;
}

function microsToNanos(us) {
  return us * 1e3;
}

describe('Bucket functions', () => {
  it('age 200us', () => {
    const f = BucketFunctions.age(200, 'us');
    assert.equal(f(microsToNanos(-1)), 'future');
    assert.equal(f(microsToNanos(0)), '025us');
    assert.equal(f(microsToNanos(1)), '025us');
    assert.equal(f(microsToNanos(25)), '025us');
    assert.equal(f(microsToNanos(26)), '050us');
    assert.equal(f(microsToNanos(50)), '050us');
    assert.equal(f(microsToNanos(51)), '100us');
    assert.equal(f(microsToNanos(71)), '100us');
    assert.equal(f(microsToNanos(101)), '200us');
    assert.equal(f(microsToNanos(191)), '200us');
    assert.equal(f(microsToNanos(200)), '200us');
    assert.equal(f(microsToNanos(201)), 'old');
  });

  it('age 2ms', () => {
    const f = BucketFunctions.age(2, 'ms');
    assert.equal(f(microsToNanos(-1)), 'future');
    assert.equal(f(microsToNanos(0)), '0250us');
    assert.equal(f(microsToNanos(1)), '0250us');
    assert.equal(f(microsToNanos(250)), '0250us');
    assert.equal(f(microsToNanos(251)), '0500us');
    assert.equal(f(microsToNanos(500)), '0500us');
    assert.equal(f(microsToNanos(501)), '1000us');
    assert.equal(f(microsToNanos(701)), '1000us');
    assert.equal(f(microsToNanos(1001)), '2000us');
    assert.equal(f(microsToNanos(1801)), '2000us');
    assert.equal(f(microsToNanos(2000)), '2000us');
    assert.equal(f(microsToNanos(2001)), 'old');
  });

  it('age 60s', () => {
    const f = BucketFunctions.age(60, 's');
    assert.equal(f(secondsToNanos(-1)), 'future');
    assert.equal(f(secondsToNanos(0)), '07s');
    assert.equal(f(secondsToNanos(1)), '07s');
    assert.equal(f(secondsToNanos(6)), '07s');
    assert.equal(f(secondsToNanos(8)), '15s');
    assert.equal(f(secondsToNanos(10)), '15s');
    assert.equal(f(secondsToNanos(20)), '30s');
    assert.equal(f(secondsToNanos(30)), '30s');
    assert.equal(f(secondsToNanos(31)), '60s');
    assert.equal(f(secondsToNanos(42)), '60s');
    assert.equal(f(secondsToNanos(60)), '60s');
    assert.equal(f(secondsToNanos(61)), 'old');
  });

  it('age 60s bias old', () => {
    const f = BucketFunctions.ageBiasOld(60, 's');
    assert.equal(f(secondsToNanos(-1)), 'future');
    assert.equal(f(secondsToNanos(0)), '30s');
    assert.equal(f(secondsToNanos(1)), '30s');
    assert.equal(f(secondsToNanos(6)), '30s');
    assert.equal(f(secondsToNanos(8)), '30s');
    assert.equal(f(secondsToNanos(10)), '30s');
    assert.equal(f(secondsToNanos(20)), '30s');
    assert.equal(f(secondsToNanos(30)), '30s');
    assert.equal(f(secondsToNanos(31)), '45s');
    assert.equal(f(secondsToNanos(42)), '45s');
    assert.equal(f(secondsToNanos(48)), '52s');
    assert.equal(f(secondsToNanos(59)), '60s');
    assert.equal(f(secondsToNanos(60)), '60s');
    assert.equal(f(secondsToNanos(61)), 'old');
  });

  it('bytes 1k', () => {
    const f = BucketFunctions.bytes(1024);
    assert.equal(f(-1), 'negative');
    assert.equal(f(212), '0256_B');
    assert.equal(f(512), '0512_B');
    assert.equal(f(761), '1024_B');
    assert.equal(f(2012), 'large');
  });

  it('bytes 20k', () => {
    const f = BucketFunctions.bytes(20000);
    assert.equal(f(-1), 'negative');
    assert.equal(f(761), '02_KiB');
    assert.equal(f(4567), '04_KiB');
    assert.equal(f(15761), '19_KiB');
    assert.equal(f(20001), 'large');
  });

  it('bytes 5M', () => {
    const f = BucketFunctions.bytes(5 * 1024 * 1024);
    assert.equal(f(-1), 'negative');
    assert.equal(f(100), '0640_KiB');
    assert.equal(f(5e5), '0640_KiB');
    assert.equal(f(1e6), '1280_KiB');
    assert.equal(f(2e6), '2560_KiB');
    assert.equal(f(5e6), '5120_KiB');
    assert.equal(f(6e6), 'large');
  });

  it('bytes max values', () => {
    const MAX = BucketFunctions.MAX_VALUE;
    const f = BucketFunctions.bytes(MAX);
    assert.equal(f(-1), 'negative');
    assert.equal(f(761), '1024_PiB');
    assert.equal(f(MAX / 4), '2048_PiB');
    assert.equal(f(MAX / 2), '4096_PiB');
    assert.equal(f(MAX), '8192_PiB');
  });

  it('latency 100ms', () => {
    const f = BucketFunctions.latency(100, 'ms');
    assert.equal(f(millisToNanos(0)), '012ms');
    assert.equal(f(millisToNanos(1)), '012ms');
    assert.equal(f(millisToNanos(13)), '025ms');
    assert.equal(f(millisToNanos(25)), '025ms');
    assert.equal(f(millisToNanos(99)), '100ms');
    assert.equal(f(millisToNanos(101)), 'slow');
  });

  it('latency 100ms bias slow', () => {
    const f = BucketFunctions.latencyBiasSlow(100, 'ms');
    assert.equal(f(millisToNanos(-1)), 'negative_latency');
    assert.equal(f(millisToNanos(0)), '050ms');
    assert.equal(f(millisToNanos(1)), '050ms');
    assert.equal(f(millisToNanos(13)), '050ms');
    assert.equal(f(millisToNanos(25)), '050ms');
    assert.equal(f(millisToNanos(74)), '075ms');
    assert.equal(f(millisToNanos(75)), '075ms');
    assert.equal(f(millisToNanos(76)), '087ms');
    assert.equal(f(millisToNanos(99)), '100ms');
    assert.equal(f(millisToNanos(101)), 'slow');
  });

  it('latency 3s', () => {
    const f = BucketFunctions.latency(3, 's');
    assert.equal(f(millisToNanos(-1)), 'negative_latency');
    assert.equal(f(millisToNanos(0)), '0375ms');
    assert.equal(f(millisToNanos(25)), '0375ms');
    assert.equal(f(millisToNanos(740)), '0750ms');
    assert.equal(f(millisToNanos(1000)), '1500ms');
    assert.equal(f(millisToNanos(1567)), '3000ms');
    assert.equal(f(millisToNanos(3001)), 'slow');
  });

  it('latency 3s bias slow', () => {
    const f = BucketFunctions.latencyBiasSlow(3, 's');
    assert.equal(f(millisToNanos(-1)), 'negative_latency');
    assert.equal(f(millisToNanos(0)), '1500ms');
    assert.equal(f(millisToNanos(1000)), '1500ms');
    assert.equal(f(millisToNanos(1740)), '2250ms');
    assert.equal(f(millisToNanos(2240)), '2250ms');
    assert.equal(f(millisToNanos(2540)), '2625ms');
    assert.equal(f(millisToNanos(2625)), '2625ms');
    assert.equal(f(millisToNanos(2800)), '3000ms');
    assert.equal(f(millisToNanos(3000)), '3000ms');
    assert.equal(f(millisToNanos(3001)), 'slow');
  });

  function checkLatencyRange(latencyFun) {
    for (let fmt of BucketFunctions.formatters.time) {
      const max = fmt.max;
      const f = latencyFun(max, 'ns');
      const keys = new Set();
      const step = (max > 37) ? Math.floor(max / 37) : 1;
      for (let j = 0; max - j > step; j += step) {
        keys.add(f(j));
      }
      keys.add(f(max));
      assert.equal(keys.size, 4);
      assert.equal(f(-1), 'negative_latency');

      // can't simply do + 1 due to loss of precision for doubles approaching LONG_MAX
      assert.equal(f(max + max), 'slow');
    }
  }

  it('latency range', () => {
    checkLatencyRange(BucketFunctions.latency);
  });

  it('latency bias slow range', () => {
    checkLatencyRange(BucketFunctions.latencyBiasSlow);
  });

  it('decimal 20k', () => {
    const f = BucketFunctions.decimal(20000);
    assert.equal(f(-1), 'negative');
    assert.equal(f(761), '02_k');
    assert.equal(f(4567), '05_k');
    assert.equal(f(15761), '20_k');
    assert.equal(f(20001), 'large');
  });

  it('decimal 5G', () => {
    const f = BucketFunctions.decimal(5 * 1e9);
    assert.equal(f(-1), 'negative');
    assert.equal(f(761), '0625_M');
    assert.equal(f(700 * 1e6), '1250_M');
    assert.equal(f(2000 * 1e6), '2500_M');
    assert.equal(f(4000 * 1e6), '5000_M');
    assert.equal(f(6e9), 'large');
  });

  it('decimal 2M', () => {
    const f = BucketFunctions.decimal(2 * 1e6);
    assert.equal(f(-1), 'negative');
    assert.equal(f(761), '0250_k');
    assert.equal(f(400  * 1e3), '0500_k');
    assert.equal(f(1000 * 1e3), '1000_k');
    assert.equal(f(2 * 1e6), '2000_k');
    assert.equal(f(2.1 * 1e6), 'large');
  });

  it('decimal max value', () => {
    const f = BucketFunctions.decimal(BucketFunctions.MAX_VALUE);
    assert.equal(f(-1), 'negative');
    assert.equal(f(761), '1152_P');
    assert.equal(f(BucketFunctions.MAX_VALUE / 4), '2305_P');
    assert.equal(f(BucketFunctions.MAX_VALUE / 2), '4611_P');
    assert.equal(f(BucketFunctions.MAX_VALUE), '9223_P');
  });
});
