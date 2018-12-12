'use strict';

class CounterState {
  constructor(counter) {
    this.counter = counter;
    this.interval = undefined;
    this.functions = [];
    this.prevNumbers = [];
  }

  add(f) {
    this.functions.push(f);
    this.prevNumbers.push(f());
  }

  schedule(delay) {
    if (!this.interval) {
      this.interval = setInterval(CounterState.update, delay, this);
    }
  }

  static update(self) {
    // each function generates a value
    // add each delta to the counter associated with us
    for (let i = 0; i < self.functions.length; ++i) {
      const f = self.functions[i];
      const prev = self.prevNumbers[i];
      const current = f();
      if (current > prev) {
        console.log(`Incrementing ${self.counter.id.key} by ${current - prev}`);
        self.counter.add(current - prev);
        self.prevNumbers[i] = current;
      }
    }
  }
}

class ValueState {
  constructor(gauge) {
    this.gauge = gauge;
    this.interval = undefined;
    this.functions = [];
  }

  add(f) {
    this.functions.push(f);
  }

  schedule(delay) {
    if (!this.interval) {
      this.interval = setInterval(ValueState.update, delay, this);
    }
  }

  static update(self) {
    // each function generates a value
    // add all of them and set the value of the gauge to that result
    let result = 0;
    for (let f of self.functions) {
      result += f();
    }
    console.log(`Setting gauge ${self.gauge.id.key} to ${result}`);
    self.gauge.set(result);
  }
}

class PolledMeter {
  static using(registry) {
    class Builder {
      constructor(r) {
        this.registry = r;
      }

      withId(id) {
        this.id = id;
        return this;
      }

      withName(name) {
        this.name = name;
        return this;
      }

      withTags(tags) {
        this.tags = tags;
        return this;
      }

      monitorValue(fun) {
        let id;
        const r = this.registry;
        if (this.id) {
          id = this.id;
        } else {
          id = r.newId(this.name, this.tags);
        }
        const gauge = r.gauge(id);
        const state = r.state;
        let c = state.get(id.key);
        if (!c) {
          c = new ValueState(gauge);
          state.set(id.key, c);
        } else {
          if (c.constructor.name !== 'ValueState') {
            registry.throwTypeError(id, c.constructor.name, 'ValueState', 'PolledMeter');
          }
        }
        if (c.constructor.name === 'ValueState') {
          c.add(fun);
          c.schedule(r.config.gaugePollingFrequency);
        }
      }

      monitorMonotonicNumber(fun) {
        let id;
        const r = this.registry;
        if (this.id) {
          id = this.id;
        } else {
          id = r.newId(this.name, this.tags);
        }
        const counter = r.counter(id);
        const state = r.state;
        let c = state.get(id.key);
        if (!c) {
          c = new CounterState(counter);
          state.set(id.key, c);
        } else {
          if (c.constructor.name !== 'CounterState') {
            registry.throwTypeError(id, c.constructor.name, 'ValueState', 'PolledMeter');
          }
        }
        if (c.constructor.name === 'CounterState') {
          c.add(fun);
          c.schedule(r.config.gaugePollingFrequency);
        }
      }
    }

    return new Builder(registry);
  }
}

module.exports = PolledMeter;
