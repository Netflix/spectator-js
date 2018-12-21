'use strict';

const Counter = require('./counter');
const Gauge = require('./gauge');

class NopRegistry {
  constructor() {
    this.state = new Map();
    this.config = {
      gaugePollingFrequency: 10000
    };
  }

  counter(id) {
    return new Counter(id);
  }
  gauge(id) {
    return new Gauge(id);
  }

  schedulePeriodically() {
    console.log(JSON.stringify(arguments));
  }

  hrtime() {
    return [0, 0];
  }
}

module.exports = NopRegistry;
