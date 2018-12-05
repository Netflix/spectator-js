'use strict';

class Counter {
  constructor(id) {
    this.id = id;
    this.count = 0;
  }

  increment(delta) {
    if (delta) {
      if (delta > 0) {
        this.count += delta;
      }
    } else {
      ++this.count;
    }
  }

  add(delta) {
    this.increment(delta);
  }

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
