'use strict';

/** Distribution summaries that get updated based on the bucket for recorded values. */
class BucketDistributionSummary {
  static get(registry, id, bucketFunction) {
    return new BucketDistributionSummary(registry, id, bucketFunction);
  }

  /**
   * Creates a distribution summary object that manages a set of distribution summaries based on
   * the bucket function supplied. Calling record will be mapped to the record on the appropriate
   * distribution summary.
   *
   * @param {registry} registry
   *     Registry to use.
   * @param {id} id
   *     Identifier for the metric being registered.
   * @param {function} bucketFunction
   *     Function to map values to buckets. See {@link BucketFunctions} for more information.
   */
  constructor(registry, id, bucketFunction) {
    this.registry = registry;
    this.id = id;
    this.bucketFunction = bucketFunction;
  }

  _distSummary(bucket) {
    return this.registry.distributionSummary(this.id.withTag('bucket', bucket));
  }

  record(amount) {
    this._distSummary(this.bucketFunction(amount)).record(amount);
  }
}

module.exports = BucketDistributionSummary;
