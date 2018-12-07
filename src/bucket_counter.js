'use strict';

/** Counters that get incremented based on the bucket for recorded values. */
class BucketCounter {
  /**
   * Creates a distribution summary object that manages a set of counters based on the bucket
   * function supplied. Calling record will increment the appropriate counter.
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

  _counter(bucket) {
    return this.registry.counter(this.id.withTag('bucket', bucket));
  }

  record(amount) {
    this._counter(this.bucketFunction(amount)).increment();
  }
}

module.exports = BucketCounter;
