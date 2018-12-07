'use strict';

const LONG_MAX_VALUE = 0x7fffffffffffffff;
const BINARY_FORMATTERS = [];
const DECIMAL_FORMATTERS = [];
const TIME_FORMATTERS = [];

function toNanos(amount, unit) {
  switch (unit) {
    case 'ns':
      return amount;
    case 'us':
      return amount * 1e3;
    case 'ms':
      return amount * 1e6;
    case 's':
      return amount * 1e9;
    case 'min':
      return amount * 60 * 1e9;
    case 'h':
      return amount * 60 * 60 * 1e9;
    case 'd':
      return amount * 24 * 60 * 60 * 1e9;
    default:
      // should we throw?
      return 0;
  }
}

function fromNanos(amount, unit) {
  switch (unit) {
    case 'ns':
      return amount;
    case 'us':
      return Math.floor(amount / 1e3);
    case 'ms':
      return Math.floor(amount / 1e6);
    case 's':
      return Math.floor(amount / 1e9);
    case 'min':
      return Math.floor(amount / (60 * 1e9));
    case 'h':
      return Math.floor(amount / (60 * 60 * 1e9));
    case 'd':
      return Math.floor(amount / (24 * 60 * 60 * 1e9));
    default:
      // should we throw?
      return 0;
  }
}

function zeroPad(width, suffix, v) {
  const amount = Math.floor(v).toString(10);
  const zerosNeeded = width - amount.length;
  let result = amount;
  for (let i = 0; i < zerosNeeded; ++i) {
    result = '0' + result;
  }
  return result + suffix;
}

function valueFormatter(max, width, suffix, cnv) {
  return {
    max: max,
    newBucket: (v) => {
      return { name: zeroPad(width, suffix, cnv(v)), upperBoundary: v};
    }
  };
}


(function setupFormatters() {
  function fmt(max, width, unit) {
    return valueFormatter(max, width, unit, (v) => fromNanos(v, unit));
  }

  function bin(max, pow, width, suffix) {
    const factor = Math.pow(2, pow * 10);
    const maxBytes = max * factor;
    return valueFormatter(maxBytes, width, suffix, (v) => v / factor);
  }

  function dec(max, pow, width, suffix) {
    const factor = Math.pow(10, pow);
    const maxBytes = max * factor;
    return valueFormatter(maxBytes, width, suffix, (v) => v / factor);
  }

  TIME_FORMATTERS.push(fmt(10, 1,  'ns'));
  TIME_FORMATTERS.push(fmt(100, 2, 'ns'));
  TIME_FORMATTERS.push(fmt(1e3, 3, 'ns'));
  TIME_FORMATTERS.push(fmt(8 * 1e3, 4, 'ns'));

  TIME_FORMATTERS.push(fmt(10 * 1e3, 1, 'us'));
  TIME_FORMATTERS.push(fmt(100 * 1e3, 2, 'us'));
  TIME_FORMATTERS.push(fmt(1e6, 3, 'us'));
  TIME_FORMATTERS.push(fmt(8 * 1e6, 4, 'us'));

  TIME_FORMATTERS.push(fmt(10 * 1e6, 1, 'ms'));
  TIME_FORMATTERS.push(fmt(100 * 1e6, 2, 'ms'));
  TIME_FORMATTERS.push(fmt(1e9, 3, 'ms'));
  TIME_FORMATTERS.push(fmt(8 * 1e9, 4, 'ms'));

  TIME_FORMATTERS.push(fmt(10 * 1e9, 1, 's'));
  TIME_FORMATTERS.push(fmt(100 * 1e9, 2, 's'));
  TIME_FORMATTERS.push(fmt(toNanos(8, 'min'), 4, 's'));

  TIME_FORMATTERS.push(fmt(toNanos(10, 'min'), 1, 'min'));
  TIME_FORMATTERS.push(fmt(toNanos(100, 'min'), 2, 'min'));
  TIME_FORMATTERS.push(fmt(toNanos(8, 'h'), 3, 'min'));
  TIME_FORMATTERS.push(fmt(toNanos(10, 'h'), 1, 'h'));
  TIME_FORMATTERS.push(fmt(toNanos(100, 'h'), 2, 'h'));
  TIME_FORMATTERS.push(fmt(toNanos(8, 'd'), 3, 'h'));
  TIME_FORMATTERS.push(fmt(toNanos(10, 'd'), 1, 'd'));
  TIME_FORMATTERS.push(fmt(toNanos(100, 'd'), 2, 'd'));
  TIME_FORMATTERS.push(fmt(toNanos(1000, 'd'), 3, 'd'));
  TIME_FORMATTERS.push(fmt(toNanos(10000, 'd'), 4, 'd'));
  TIME_FORMATTERS.push(fmt(toNanos(100000, 'd'), 5, 'd'));
  TIME_FORMATTERS.push(fmt(LONG_MAX_VALUE, 6, 'd'));


  const binaryUnits = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  for (let i = 0; i < binaryUnits.length; ++i) {
    BINARY_FORMATTERS.push(bin(10,    i, 1, '_' + binaryUnits[i]));
    BINARY_FORMATTERS.push(bin(100,   i, 2, '_' + binaryUnits[i]));
    BINARY_FORMATTERS.push(bin(1000,  i, 3, '_' + binaryUnits[i]));
    BINARY_FORMATTERS.push(bin(10000, i, 4, '_' + binaryUnits[i]));
  }

  const decimalUnits = ['', '_k', '_M', '_G', '_T', '_P'];
  for (let i = 0; i < decimalUnits.length; ++i) {
    const pow = i * 3;
    DECIMAL_FORMATTERS.push(dec(10,   pow, 1, decimalUnits[i]));
    DECIMAL_FORMATTERS.push(dec(100,  pow, 2, decimalUnits[i]));
    DECIMAL_FORMATTERS.push(dec(1000, pow, 3, decimalUnits[i]));
    DECIMAL_FORMATTERS.push(dec(10000, pow, 4, decimalUnits[i]));
  }
}());

function getFormatter(fmts, max) {
  for (let f of fmts) {
    if (max < f.max) {
      return f;
    }
  }

  return fmts[fmts.length - 1];
}

function bucketFunction(buckets, fallback) {
  return function(amount) {
    for (let b of buckets) {
      if (amount <= b.upperBoundary) {
        return b.name;
      }
    }
    return fallback;
  };
}

function biasZero(ltZero, gtMax, max, fmt) {
  const buckets = new Array(5);
  buckets[0] = {name: ltZero, upperBoundary: -1};
  buckets[1] = fmt.newBucket(max / 8);
  buckets[2] = fmt.newBucket(max / 4);
  buckets[3] = fmt.newBucket(max / 2);
  buckets[4] = fmt.newBucket(max);
  return bucketFunction(buckets, gtMax);
}

function biasMax(ltZero, gtMax, max, fmt) {
  const buckets = new Array(5);
  buckets[0] = {name: ltZero, upperBoundary: -1};
  buckets[1] = fmt.newBucket(max - max / 2);
  buckets[2] = fmt.newBucket(max - max / 4);
  buckets[3] = fmt.newBucket(max - max / 8);
  buckets[4] = fmt.newBucket(max);
  return bucketFunction(buckets, gtMax);
}

function timeBias(biasFun, ltZero, gtMax, max, unit) {
  const v = toNanos(max, unit);
  const fmt = getFormatter(TIME_FORMATTERS, v);
  return biasFun(ltZero, gtMax, v, fmt);
}

function timeBiasZero(ltZero, gtMax, max, unit) {
  return timeBias(biasZero, ltZero, gtMax, max, unit);
}

function timeBiasMax(ltZero, gtMax, max, unit) {
  return timeBias(biasMax, ltZero, gtMax, max, unit);
}

/**
 * Returns a function that maps age values to a set of buckets. Example use-case would be
 * tracking the age of data flowing through a processing pipeline. Values that are less than
 * 0 will be marked as "future". These typically occur due to minor variations in the clocks
 * across nodes. In addition to a bucket at the max, it will create buckets at max / 2, max / 4,
 * and max / 8.
 *
 * @param {number} max
 *     Maximum expected age of data flowing through. Values greater than this max will be mapped
 *     to an "old" bucket.
 * @param {string} unit
 *     Unit for the max value: 'd', 'h', 'min', 's', 'ms', 'us', 'ns'
 * @return {function}
 *     Function mapping age values to string labels. The labels for buckets will sort
 *     so they can be used with a simple group by.
 */
function age(max, unit) {
  return timeBiasZero('future', 'old', max, unit);
}

/**
 * Returns a function that maps age values to a set of buckets. Example use-case would be
 * tracking the age of data flowing through a processing pipeline. Values that are less than
 * 0 will be marked as "future". These typically occur due to minor variations in the clocks
 * across nodes. In addition to a bucket at the max, it will create buckets at max - max / 8,
 * max - max / 4, and max - max / 2.
 *
 * @param {number} max
 *     Maximum expected age of data flowing through. Values greater than this max will be mapped
 *     to an "old" bucket.
 * @param {string} unit
 *     Unit for the max value: 'd', 'h', 'min', 's', 'ms', 'us', 'ns'
 * @return {function}
 *     Function mapping age values to string labels. The labels for buckets will sort
 *     so they can be used with a simple group by.
 */
function ageBiasOld(max, unit) {
  return timeBiasMax('future', 'old', max, unit);
}

/**
 * Returns a function that maps size values in bytes to a set of buckets. The buckets will
 * use <a href="https://en.wikipedia.org/wiki/Binary_prefix">binary prefixes</a> representing
 * powers of 1024. If you want powers of 1000, then see decimal
 *
 * @param {number} max
 *     Maximum expected size of data being recorded. Values greater than this amount will be
 *     mapped to a "large" bucket.
 * @return {function}
 *     Function mapping size values to string labels. The labels for buckets will sort
 *     so they can be used with a simple group by.
 */
function bytes(max) {
  const f = getFormatter(BINARY_FORMATTERS, max);
  return biasZero('negative', 'large', max, f);
}

/**
 * Returns a function that maps latencies to a set of buckets. Example use-case would be
 * tracking the amount of time to process a request on a server. Values that are less than
 * 0 will be marked as "negative_latency". These typically occur due to minor variations in the
 * clocks to measure the latency and having a
 * time adjustment between the start and end. In addition to a bucket at the max, it will create
 * buckets at max / 2, max / 4, and max / 8.
 *
 * @param {number} max
 *     Maximum expected age of data flowing through. Values greater than this max will be mapped
 *     to an "old" bucket.
 * @param {string} unit
 *     Unit for the max value: 'd', 'h', 'min', 's', 'ms', 'us', 'ns'
 * @return {function}
 *     Function mapping age values to string labels. The labels for buckets will sort
 *     so they can be used with a simple group by.
 */
function latency(max, unit) {
  return timeBiasZero('negative_latency', 'slow', max, unit);
}

/**
 * Returns a function that maps latencies to a set of buckets. Example use-case would be
 * tracking the amount of time to process a request on a server. Values that are less than
 * 0 will be marked as "negative_latency". These typically occur due to minor variations in the
 * clocks to measure the latency and having a
 * time adjustment between the start and end. In addition to a bucket at the max, it will create
 * buckets at max - max / 8, max - max / 4, and max - max / 2.
 *
 * @param {number} max
 *     Maximum expected age of data flowing through. Values greater than this max will be mapped
 *     to an "old" bucket.
 * @param {string} unit
 *     Unit for the max value: 'd', 'h', 'min', 's', 'ms', 'us', 'ns'
 * @return {function}
 *     Function mapping age values to string labels. The labels for buckets will sort
 *     so they can be used with a simple group by.
 */
function latencyBiasSlow(max, unit) {
  return timeBiasMax('negative_latency', 'slow', max, unit);
}

/**
 * Returns a function that maps size values to a set of buckets. The buckets will
 * use <a href="https://en.wikipedia.org/wiki/Metric_prefix">decimal prefixes</a> representing
 * powers of 1000. If you are measuring quantities in bytes and want powers of 1024, then see
 * bytes
 *
 * @param {number} max
 *     Maximum expected size of data being recorded. Values greater than this amount will be
 *     mapped to a "large" bucket.
 * @return {function}
 *     Function mapping size values to string labels. The labels for buckets will sort
 *     so they can be used with a simple group by.
 */
function decimal(max) {
  const f = getFormatter(DECIMAL_FORMATTERS, max);
  return biasZero('negative', 'large', max, f);
}

module.exports = {
  MAX_VALUE: LONG_MAX_VALUE,
  age: age,
  ageBiasOld: ageBiasOld,
  bytes: bytes,
  latency: latency,
  latencyBiasSlow: latencyBiasSlow,
  decimal: decimal,

  // for testing
  formatters: {
    time: Object.freeze(TIME_FORMATTERS),
    decimal: Object.freeze(DECIMAL_FORMATTERS),
    binary: Object.freeze(BINARY_FORMATTERS)
  }
};
