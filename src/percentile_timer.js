'use strict';

const PercentileBuckets = require('./percentile_buckets');

const percentiles = new Array(PercentileBuckets.length());
for (let i = 0; i < percentiles.length; ++i) {
  let hex = i.toString(16);
  const hexLen = hex.length;
  const zerosNeeded = 4 - hexLen;
  for (let z = 0; z < zerosNeeded; ++z) {
    hex = '0' + hex;
  }
  percentiles[i] = 'T' + hex;
}

/**
 * Timer that buckets the counts to allow for estimating percentiles. This timer type will track
 * the data distribution for the timer by maintaining a set of counters. The distribution
 * can then be used on the server side to estimate percentiles while still allowing for
 * arbitrary slicing and dicing based on dimensions.
 *
 * <p><b>Percentile timers are expensive compared to basic timers from the registry.</b> In
 * particular they have a higher storage cost, worst case ~300x, to maintain the data
 * distribution. Be diligent about any additional dimensions added to percentile timers and
 * ensure they have a small bounded cardinality. In addition it is highly recommended to
 * set a range whenever possible to greatly restrict the worst case overhead.</p>
 *
 * <p>When using the builder, the range will default from 10 ms
 * to 1 minute. Based on data at Netflix this is the most common range for request latencies
 * and restricting to this window reduces the worst case multiple from 276 to 58</p>
 */
class PercentileTimer {
  static get(registry, id) {
    return new PercentileTimer(registry, id);
  }

  /**
   * Creates a timer object that can be used for estimating percentiles. <b>Percentile timers
   * are expensive compared to basic timers from the registry.</b> Be diligent with ensuring
   * that any additional dimensions have a small bounded cardinality. It is also highly
   * recommended to explicitly set a range
   *
   * @param {registry} registry spectator registry to use
   * @param {id} id meter id
   * @param {number} min minimum number of nanoseconds (default 0)
   * @param {number} max maximum number of nanoseconds (default 2^63 - 1)
   */
  constructor(registry, id, min, max) {
    this.registry = registry;
    this.id = id;
    this.timer = registry.timer(id);
    this.min = min || 0;
    this.max = max || PercentileBuckets.maxValue();
    this.counters = new Array(PercentileBuckets.length());
  }

  static get Builder() {
    class Builder {
      constructor(registry) {
        this.registry = registry;
        this.min = 10 * 1e6; // 10 ms
        this.max = 60 * 1e9; // 1 min
      }
      withId(id) {
        this.id = id;
        return this;
      }
      withName(name) {
        this.name = name;
        return this;
      }
      withTags(tags) {
        this.tags = tags;
        return this;
      }
      withRangeSeconds(min, max) {
        this.min = min * 1e9;
        this.max = max * 1e9;
        return this;
      }
      withRangeMilliseconds(min, max) {
        this.min = min * 1e6;
        this.max = max * 1e6;
        return this;
      }
      withRangeNanoseconds(min, max) {
        this.min = min;
        this.max = max;
        return this;
      }
      build() {
        let id;
        if (this.id) {
          id = this.id;
        } else {
          id = this.registry.createId(this.name, this.tags);
        }
        return new PercentileTimer(this.registry, id, this.min, this.max);
      }
    }
    return Builder;
  }

  _counterFor(i) {
    let c = this.counters[i];
    if (!c) {
      const counterId = this.id.withTags(
        {statistic: 'percentile', percentile: percentiles[i]});
      c = this.registry.counter(counterId);
      this.counters[i] = c;
    }
    return c;
  }

  _restrict(amount) {
    const v = Math.min(amount, this.max);
    return Math.max(v, this.min);
  }

  record(seconds, nanos) {

    let actualNanos;
    let actualSeconds;
    // handle record(0, 100) and record([0, 100])
    if (seconds instanceof Array) {
      actualSeconds = seconds[0] || 0;
      actualNanos = seconds[1] || 0;
    } else {
      actualSeconds = seconds || 0;
      actualNanos = nanos || 0;
    }

    const totalNanos = actualSeconds * 1e9 + actualNanos;
    if (totalNanos >= 0) {
      this.timer.record(seconds, nanos);
      const restrictedNanos = this._restrict(totalNanos);
      this._counterFor(PercentileBuckets.indexOf(restrictedNanos)).increment();
    }
  }

  /**
   * Computes the percentile for this timer. The unit will be in seconds.
   * @param {number} p -- Percentile to compute
   * @returns {number} An approximation of the `p`th percentile in seconds.
   */
  percentile(p) {
    const counts = new Array(PercentileBuckets.length());
    for (let i = 0; i < counts.length; ++i) {
      counts[i] = this._counterFor(i).count;
    }
    const ps = PercentileBuckets.percentiles(counts, [p]);
    return ps[0] / 1e9;
  }

  get count() {
    return this.timer.count;
  }

  get totalTime() {
    return this.timer.totalTime;
  }
}

module.exports = PercentileTimer;
