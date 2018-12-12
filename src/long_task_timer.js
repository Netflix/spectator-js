'use strict';

const PolledMeter = require('./polled_meter');
const NopRegistry = require('./nop_registry');

/**
 * Timer intended to track a small number of long running tasks. Example would be something like
 * a batch hadoop job. Though "long running" is a bit subjective the assumption is that anything
 * over a minute is long running.
 */
class LongTaskTimer {
  // Use LongTaskTimer.get() - do not use this constructor directly
  constructor(registry) {
    this.registry = registry;
    this.tasks = new Map();
    this.nextTask = 0;
  }

  /**
   * Start a new long running task.
   *
   * @returns {number} A task id that can be later used when calling stop()
   */
  start() {
    const taskId = this.nextTask++;
    this.tasks.set(taskId, this.registry.hrtime());
    return taskId;
  }

  /**
   * Stops tracking the given task.
   *
   * @param {number} task A task id previously gotten using start()
   * @returns {number} The duration for the task in seconds
   */
  stop(task) {
    const startTime = this.tasks.get(task);
    if (startTime) {
      this.tasks.delete(task);
      const elapsed = this.registry.hrtime(startTime);
      return elapsed[0] + elapsed[1] / 1e9;
    }
    return -1;
  }

  /**
   * Get the number of tasks currently being tracked by this timer.
   *
   * @returns {number} The number of active tasks
   */
  get activeTasks() {
    return this.tasks.size;
  }

  /**
   * Get the sum of the duration in seconds of all active tasks.
   *
   * @returns {number} The number of seconds representing the sum
   * of the duration of all running tasks.
   */
  get duration() {
    let elapsedSeconds = 0;
    for (let start of this.tasks.values()) {
      const elapsed = this.registry.hrtime(start);
      elapsedSeconds += elapsed[0] + elapsed[1] / 1e9;
    }
    return elapsedSeconds;
  }

  /**
   * Creates a timer for tracking long running tasks.
   *
   * @param {Registry} registry
   *     Registry to use.
   * @param {MeterId} id
   *     Identifier for the metric being registered.
   * @return {LongTaskTimer}
   *     Timer instance.
   */
  static get(registry, id) {
    const state = registry.state;
    let timer = state.get(id.key);
    if (timer) {
      if (timer.constructor.name === 'LongTaskTimer') {
        return timer;
      }
      // throws if strictMode
      registry.throwTypeError(id, timer.constructor.name, 'LongTaskTimer', 'LongTaskTimer');
      return new LongTaskTimer(new NopRegistry); // dummy, not registered
    }

    // make sure we don't attempt to register an id which is used for something else
    const prevMeter = registry.metersMap.get(id.key);
    if (prevMeter) {
      // throws if strictMode
      registry.throwTypeError(id, prevMeter.constructor.name, 'LongTaskTimer', 'LongTaskTimer');
      return new LongTaskTimer(new NopRegistry);
    }
    timer = new LongTaskTimer(registry);
    state.set(id.key, timer);

    PolledMeter.using(registry).withId(id.withStat('activeTasks'))
      .monitorValue(() => timer.activeTasks);
    PolledMeter.using(registry).withId(id.withStat('duration'))
      .monitorValue(() => timer.duration);

    return timer;
  }
}

module.exports = LongTaskTimer;
