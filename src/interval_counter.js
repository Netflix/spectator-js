'use strict';

const PolledMeter = require('./polled_meter');
const NopRegistry = require('./nop_registry');

/**
 * A counter that also keeps track of the time since last update.
 */
class IntervalCounter {
  // Use IntervalCounter.get() - do not use this constructor directly
  constructor(registry, id) {
    this.registry = registry;
    this.counter = registry.counter(id.withStat('count'));
    this.lastUpdated = undefined;
    PolledMeter.using(registry)
      .withId(id.withStat('duration')).monitorValue(() => this.secondsSinceLastUpdate);
  }

  add(delta) {
    this.lastUpdated = this.registry.hrtime();
    this.counter.add(delta);
  }

  get count() {
    return this.counter.count;
  }

  get secondsSinceLastUpdate() {
    const elapsed = this.registry.hrtime(this.lastUpdated);
    return elapsed[0] + elapsed[1] / 1e9;
  }

  /**
   * Creates a counter that also keeps track of the time since last updated.
   *
   * @param {Registry} registry
   *     Registry to use.
   * @param {MeterId} id
   *     Identifier for the metric being registered.
   * @return {IntervalCounter}
   *     Timer instance.
   */
  static get(registry, id) {
    const state = registry.state;
    let ic = state.get(id.key);
    if (ic) {
      if (ic.constructor.name === 'IntervalCounter') {
        return ic;
      }
      // throws if strictMode
      registry.throwTypeError(id, ic.constructor.name, 'IntervalCounter', 'IntervalCounter');
      return new IntervalCounter(new NopRegistry(), id); // dummy, since the registry will not send any metrics
    }

    // make sure we don't attempt to register an id which is used for something else
    const prevMeter = registry.metersMap.get(id.key);
    if (prevMeter) {
      // throws if strictMode
      registry.throwTypeError(id, prevMeter.constructor.name, 'IntervalCounter', 'IntervalCounter');
      return new IntervalCounter(new NopRegistry(), id);
    }
    ic = new IntervalCounter(registry, id);
    state.set(id.key, ic);
    return ic;
  }
}

module.exports = IntervalCounter;
