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
  percentiles[i] = 'D' + hex;
}

/**
 * Distribution summary that buckets the counts to allow for estimating percentiles. This
 * distribution summary type will track the data distribution for the summary by maintaining
 * a set of counters. The distribution can then be used on the server side to estimate
 * percentiles while still allowing for arbitrary slicing and dicing based on dimensions.
 *
 * <p><b>Percentile distribution summaries are expensive compared to basic distribution summaries
 * from the registry.</b> In particular they have a higher storage cost, worst case ~300x,
 * to maintain the data distribution. Be diligent about any additional dimensions added to percentile
 * distribution summaries and ensure they have a small bounded cardinality. In addition
 * it is highly recommended to set a range whenever possible to
 * greatly restrict the worst case overhead.</p>
 */
class PercentileDistributionSummary {
  static get(registry, id) {
    return new PercentileDistributionSummary(registry, id);
  }

  /**
   * Creates a distribution summary object that can be used for estimating percentiles.
   * <b>Percentile distribution summaries are expensive compared to basic distribution summaries
   * from the registry.</b> Be diligent with ensuring
   * that any additional dimensions have a small bounded cardinality. It is also highly
   * recommended to explicitly set a range
   *
   * @param {registry} registry spectator registry to use
   * @param {id} id meter id
   * @param {number} min Amount indicating the minimum allowed value for this summary
   * @param {number} max Amount indicating the maximum allowed value for this summary
   */
  constructor(registry, id, min, max) {
    this.registry = registry;
    this.id = id;
    this.summary = registry.distributionSummary(id);
    this.min = min || 0;
    this.max = max || PercentileBuckets.maxValue();
    this.counters = new Array(PercentileBuckets.length());
  }

  static get Builder() {
    class Builder {
      constructor(registry) {
        this.registry = registry;
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

      /**
       * Sets the range for this summary. The range is should be the SLA boundary or
       * failure point for the activity. Explicitly setting the threshold allows us to optimize
       * for the important range of values and reduce the overhead associated with tracking the
       * data distribution.
       *
       * For example, suppose you are making a client call and the max payload size is 8mb. Setting
       * the threshold to 8mb will restrict the possible set of buckets used to those approaching
       * the boundary. So we can still detect if it is nearing failure, but percentiles
       * that are further away from the range may be inflated compared to the actual value.
       *
       * @param {number} min  Amount indicating the minimum allowed value for this summary.
       * @param {number} max  Amount indicating the maximum allowed value for this summary.
       * @return {Builder}    This builder instance to allow chaining of operations.
       */
      withRange(min, max) {
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
        return new PercentileDistributionSummary(this.registry, id, this.min, this.max);
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

  record(amount) {
    if (amount >= 0) {
      this.summary.record(amount);
      const restrictedAmount = this._restrict(amount);
      this._counterFor(PercentileBuckets.indexOf(restrictedAmount)).increment();
    }
  }

  /**
   * Computes the percentile for this DistributionSummary. The unit will be in seconds.
   * @param {number} p -- Percentile to compute
   * @returns {number} An approximation of the `p`th percentile in seconds.
   */
  percentile(p) {
    const counts = new Array(PercentileBuckets.length());
    for (let i = 0; i < counts.length; ++i) {
      counts[i] = this._counterFor(i).count;
    }
    return PercentileBuckets.percentiles(counts, [p])[0];
  }

  get count() {
    return this.summary.count;
  }

  get totalAmount() {
    return this.summary.totalAmount;
  }
}

module.exports = PercentileDistributionSummary;
