'use strict';

class Gauge {
  constructor(id) {
    this.id = id;
    this.value_ = NaN;
  }

  set(value) {
    this.value_ = value;
  }

  get() {
    return this.value_;
  }

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
