'use strict';

/**
 * Measures the rate of change based on calls to increment.
 */
class Counter {
  /**
   * Create a new instance with a given id.
   *
   * @param {MeterId} id identifier for this meter.
   */
  constructor(id) {
    this.id = id;
    this.count = 0;
  }

  /**
   * Update the counter by amount.
   * @param {number} [amount=1] amount to add to the counter.
   * @return {undefined}
   */
  increment(amount) {
    if (amount !== undefined) {
      if (amount > 0) {
        this.count += amount;
      }
    } else {
      ++this.count;
    }
  }

  /**
   * Update the counter by amount.
   * @param {number} [amount=1] amount to add to the counter.
   * @return {undefined}
   */
  add(amount) {
    this.increment(amount);
  }


  /**
   * Get the measurements for this meter.
   *
   * @return {Object[]} Either an empty array or an array with
   *                    one entry representing the count.
   */
  measure() {
    const c = this.count;

    if (c === 0) {
      return [];
    }

    this.count = 0;
    return [{id: this.id.withDefaultStat('count'), v: c}];
  }
}

module.exports = Counter;
