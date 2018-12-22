'use strict';

/**
 * Track the sample distribution of events. An example would be the response sizes for requests
 * hitting an http server.
 *
 *  This meter will report four measurements to atlas:
 * <ul>
 *   <li><b>count:</b> counter incremented each time record is called</li>
 *   <li><b>totalAmount:</b> counter incremented by the recorded amount</li>
 *   <li><b>totalOfSquares:</b> counter incremented by the recorded amount squared</li>
 *   <li><b>max:</b> maximum recorded amount</li>
 * </ul>
 *
 * <p>Having an explicit totalAmount and count on the backend
 * can be used to calculate an accurate average for an arbitrary grouping. The
 * totalOfSquares is used for computing a standard deviation.</p>
 *
 * <p>Note that the count and totalAmount will report
 * the values since the last measurement was taken rather than the total for the
 * life of the process.</p>
 */
class DistributionSummary {
  /**
   * Create a new instance with a given id.
   *
   * @param {MeterId} id identifier for this meter.
   */
  constructor(id) {
    this.id = id;
    this._reset();
  }

  /**
   * Reset our measurements.
   *
   * @return {undefined}
   * @private
   */
  _reset() {
    this.count = 0;
    this.totalAmount = 0;
    this.totalOfSquares = 0.0;
    this.max = 0;
  }

  /**
   * Updates the statistics kept by the summary with the specified amount.
   *
   * @param {number} amount
   *     Amount for an event being measured. For example, if the size in bytes of responses
   *     from a server. If the amount is less than 0 the value will be dropped.
   *
   * @return {undefined}
   */
  record(amount) {
    if (amount >= 0) {
      this.count++;
      this.totalAmount += amount;
      this.totalOfSquares += amount * amount;

      if (this.count === 1) {
        this.max = amount;
      } else {
        this.max = Math.max(amount, this.max);
      }
    }
  }

  /**
   * Get the measurements for this summary.
   *
   * @return {Object[]} Either an empty array or an array with
   *                    four entries representing the
   *                    count, totalAmount, totalOfSquares, and max.
   */
  measure() {
    const c = this.count;
    const t = this.totalAmount;
    const t2 = this.totalOfSquares;
    const m = this.max;

    this._reset();

    if (c > 0) {
      return [
        {id: this.id.withStat('count'), v: c},
        {id: this.id.withStat('totalAmount'), v: t},
        {id: this.id.withStat('totalOfSquares'), v: t2},
        {id: this.id.withStat('max'), v: m}
      ];
    }

    return [];
  }
}

module.exports = DistributionSummary;
