'use strict';

/**
 * A meter with a single value that can only be sampled at a point in time. A typical example is
 * a queue size.
 */
class Gauge {
  /**
   * Create a new instance with a given id.
   *
   * @param {MeterId} id identifier for this meter.
   */
  constructor(id) {
    this.id = id;
    this.value_ = NaN;
  }

  /**
   * Set the current gauge value to the specified number.
   *
   * @param {number} value Number to be used when reporting the value to atlas.
   * @return {undefined}
   */
  set(value) {
    this.value_ = value;
  }

  /**
   * Get the current value.
   * @return {number} The current value for this gauge.
   */
  get() {
    return this.value_;
  }

  /**
   * Get the current value.
   *
   * @deprecated Use get() instead.
   *
   * @return {number} The current value for this gauge.
   */
  value() {
    return this.value_;
  }

  /**
   *
   * @deprecated Use set instead.
   *
   * Set the current gauge value to the specified number.
   *
   * @param {number} value Number to be used when reporting the value to atlas.
   * @return {undefined}
   */
  update(value) {
    this.value_ = value;
  }

  /**
   * Get the measurements for this gauge.
   *
   * @return {Object[]} Either an empty array or an array with
   *                    one entry representing the
   *                    last value set.
   */
  measure() {
    const v = this.value_;
    this.value_ = NaN;

    if (isNaN(v)) {
      return [];
    }
    return [{id: this.id.withDefaultStat('gauge'), v: v}];
  }
}

module.exports = Gauge;
