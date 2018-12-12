'use strict';

const bucketValues = [];
const LONG_MAX_VALUE = 0x7fffffffffffffff;

function initialize() {
  const DIGITS = 2;
  bucketValues.push(1, 2, 3);

  let exp = DIGITS;

  while (exp < 56) {
    let current = Math.pow(2, exp);
    const delta = Math.floor(current / 3);
    let next = current * 4 - delta;

    while (current < next) {
      bucketValues.push(current);
      current += delta;
    }
    exp += DIGITS;
  }
  // unfortunately we only get 56 bits of precision so
  // we generated this table with our C++ implementation
  // following the above algorithm
  bucketValues.push(66052794534767272);
  bucketValues.push(72057594037927936);
  bucketValues.push(96076792050570581);
  bucketValues.push(120095990063213226);
  bucketValues.push(144115188075855871);
  bucketValues.push(168134386088498516);
  bucketValues.push(192153584101141161);
  bucketValues.push(216172782113783806);
  bucketValues.push(240191980126426451);
  bucketValues.push(264211178139069096);
  bucketValues.push(288230376151711744);
  bucketValues.push(384307168202282325);
  bucketValues.push(480383960252852906);
  bucketValues.push(576460752303423487);
  bucketValues.push(672537544353994068);
  bucketValues.push(768614336404564649);
  bucketValues.push(864691128455135230);
  bucketValues.push(960767920505705811);
  bucketValues.push(1056844712556276392);
  bucketValues.push(1152921504606846976);
  bucketValues.push(1537228672809129301);
  bucketValues.push(1921535841011411626);
  bucketValues.push(2305843009213693951);
  bucketValues.push(2690150177415976276);
  bucketValues.push(3074457345618258601);
  bucketValues.push(3458764513820540926);
  bucketValues.push(3843071682022823251);
  bucketValues.push(4227378850225105576);
  bucketValues.push(LONG_MAX_VALUE);
}

initialize();

function indexOf(v) {
  if (v <= 0) {
    return 0;
  } else if (v <= 15) {
    return v;
  }

  // binary search for the right spot
  let minIndex = 15;
  let maxIndex = bucketValues.length - 1;
  while (minIndex < maxIndex) {
    const mid = (minIndex + maxIndex) >>> 1;
    const computed = bucketValues[mid];
    if (computed < v) {
      minIndex = mid + 1;
    } else if (computed === v) {
      return mid + 1;
    } else {
      maxIndex = mid;
    }
  }
  return maxIndex;
}

function bucket(v) {
  return bucketValues[indexOf(v)];
}

function percentiles(counts, pcts) {
  let total = counts.reduce((sum, x) => sum + x);
  let pctIdx = 0;
  let prev = 0;
  let prevP = 0.0;
  let prevB = 0;
  let results = new Array(pcts.length);
  let i = 0;
  for (let c of counts) {
    const next = prev + c;
    const nextP = 100.0 * next / total;
    const nextB = bucketValues[i];
    i++;
    while (pctIdx < pcts.length && nextP >= pcts[pctIdx]) {
      const f = (pcts[pctIdx] - prevP) / (nextP - prevP);
      results[pctIdx] = f * (nextB - prevB) + prevB;
      ++pctIdx;
    }
    if (pctIdx >= pcts.length) {
      break;
    }
    prev = next;
    prevP = nextP;
    prevB = nextB;
  }
  return results;
}

module.exports = {
  length: () => {
    return bucketValues.length;
  },
  bucket: bucket,
  percentiles: percentiles,
  maxValue: () => {
    return LONG_MAX_VALUE;
  },
  indexOf: indexOf
};
