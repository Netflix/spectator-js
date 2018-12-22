'use strict';

/**
 * Track the duration of short events. An example would be the response latency
 * of an http server.
 *
 *  This meter will report four measurements to atlas:
 * <ul>
 *   <li><b>count:</b> counter incremented each time record is called</li>
 *   <li><b>totalTime:</b> counter incremented by the recorded amount</li>
 *   <li><b>totalOfSquares:</b> counter incremented by the recorded amount squared</li>
 *   <li><b>max:</b> maximum recorded amount</li>
 * </ul>
 *
 * <p>Having an explicit totalTime and count on the backend
 * can be used to calculate an accurate average for an arbitrary grouping. The
 * totalOfSquares is used for computing a standard deviation.</p>
 *
 * <p>Note that the count and totalTime will report
 * the values since the last measurement was taken rather than the total for the
 * life of the process.</p>
 */
class Timer {
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
    this.totalTime = 0;
    this.totalOfSquares = 0.0;
    this.max = 0;
  }

  /**
   * Updates the statistics kept by the timer with the specified
   * time.
   *
   * @param {number|number[]} seconds
   *     Number of seconds (can be fractional) or an array of
   *     two numbers containing seconds, nanoseconds such as the return
   *     value from registry.hrtime() or process.hrtime()
   *
   * @param {number} [nanos]
   *     if seconds is a number, nanos will be interpreted as number of nanoseconds
   *
   * @return {undefined}
   */
  record(seconds, nanos) {
    let totalNanos;
    const ns = nanos || 0;

    if (seconds instanceof Array) {
      totalNanos = seconds[0] * 1e9 + (seconds[1] || 0);
    } else {
      totalNanos = seconds * 1e9 + ns;
    }

    if (totalNanos >= 0) {
      this.count++;
      this.totalTime += totalNanos;
      this.totalOfSquares += totalNanos * totalNanos;

      if (this.count === 1) {
        this.max = totalNanos;
      } else {
        this.max = Math.max(totalNanos, this.max);
      }
    }
  }

  /**
   * Get the measurements for this timer.
   * Values representing times are in seconds.
   *
   * @return {Object[]} Either an empty array or an array with
   *                    four entries representing the
   *                    count, totalTime, totalOfSquares, and max.
   */
  measure() {
    const c = this.count;
    const t = this.totalTime / 1e9;
    const t2 = this.totalOfSquares / 1e18;
    const m = this.max / 1e9;

    this._reset();

    if (c > 0) {
      return [
        {id: this.id.withStat('count'), v: c},
        {id: this.id.withStat('totalTime'), v: t},
        {id: this.id.withStat('totalOfSquares'), v: t2},
        {id: this.id.withStat('max'), v: m}
      ];
    }

    return [];
  }
}

module.exports = Timer;
