'use strict';

/** Timers that get updated based on the bucket for recorded values. */
class BucketTimer {
  static get(registry, id, bucketFunction) {
    return new BucketTimer(registry, id, bucketFunction);
  }

  /**
   * Creates a timer object that manages a set of timers based on the bucket
   * function supplied. Calling record will be mapped to the record on the appropriate timer.
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

  _timer(bucket) {
    return this.registry.timer(this.id.withTag('bucket', bucket));
  }

  record(seconds, nanos) {
    let totalNanos;
    const ns = nanos || 0;

    if (seconds instanceof Array) {
      totalNanos = seconds[0] * 1e9 + (seconds[1] || 0);
    } else {
      totalNanos = seconds * 1e9 + ns;
    }

    this._timer(this.bucketFunction(totalNanos)).record(0, totalNanos);
  }
}

module.exports = BucketTimer;
