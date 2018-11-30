'use strict';

class Timer {
  constructor(id) {
    this.id = id;
    this.reset();
  }

  reset() {
    this.count = 0;
    this.totalTime = 0;
    this.totalOfSquares = 0.0;
    this.max = 0;
  }

  record(seconds, nanos) {
    let totalNanos;
    const ns = nanos || 0;

    if (seconds instanceof Array) {
      totalNanos = seconds[0] * 1e9 + seconds[1];
    } else {
      totalNanos = seconds * 1e9 + ns;
    }

    if (totalNanos >= 0) {
      this.count++;
      this.totalTime += totalNanos;
      this.totalOfSquares += 1.0 * totalNanos * totalNanos;

      if (this.count === 1) {
        this.max = totalNanos;
      } else {
        this.max = Math.max(totalNanos, this.max);
      }
    }
  }

  measure() {
    const c = this.count;
    const t = this.totalTime / 1e9;
    const t2 = this.totalOfSquares / 1e18;
    const m = this.max / 1e9;

    this.reset();

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
