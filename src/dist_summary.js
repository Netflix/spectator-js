'use strict';

class DistributionSummary {
  constructor(id) {
    this.id = id;
    this.reset();
  }

  reset() {
    this.count = 0;
    this.totalAmount = 0;
    this.totalOfSquares = 0.0;
    this.max = 0;
  }

  record(amount) {
    if (amount >= 0) {
      this.count++;
      this.totalAmount += amount;
      this.totalOfSquares += 1.0 * amount * amount;

      if (this.count === 1) {
        this.max = amount;
      } else {
        this.max = Math.max(amount, this.max);
      }
    }
  }

  measure() {
    const c = this.count;
    const t = this.totalAmount;
    const t2 = this.totalOfSquares;
    const m = this.max;

    this.reset();

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
