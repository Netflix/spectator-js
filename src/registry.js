'use strict';

const MeterId = require('./meter_id');
const Counter = require('./counter');
const Gauge = require('./gauge');
const Timer = require('./timer');
const DistributionSummary = require('./dist_summary');
const HttpClient = require('./http');
const getLoggers = require('./logger');

// internal class used to publish measurements to an aggregator service
class Publisher {
  constructor(registry) {
    this.registry = registry;
    this.http = new HttpClient(registry);
  }

  // Build a string table from the list of measurements
  // Unique words are identified, and assigned a number starting from 0 based
  // on their lexicographical order
  buildStringTable(measurements) {
    let commonTags = this.registry.commonTags;
    let table = {};

    for (let [key, value] of commonTags) {
      table[key] = 0;
      table[value] = 0;
    }
    table.name = 0;

    for (let m of measurements) {
      table[m.id.name] = 0;

      for (let [k, v] of m.id.tags) {
        table[k] = 0;
        table[v] = 0;
      }
    }
    let keys = Object.keys(table);
    keys.sort();
    keys.forEach((v, idx) => {
      table[v] = idx;
    });
    return table;
  }

  appendMeasurement(payload, table, measure) {
    const op = opForMeasurement(measure);
    const commonTags = this.registry.commonTags;
    const tags = measure.id.tags;
    const len = tags.size + 1 + commonTags.size;
    payload.push(len);

    for (let [k, v] of commonTags) {
      payload.push(table[k]);
      payload.push(table[v]);
    }

    for (let [k, v] of tags) {
      payload.push(table[k]);
      payload.push(table[v]);
    }
    payload.push(table.name);
    payload.push(table[measure.id.name]);
    payload.push(op);
    payload.push(measure.v);
  }

  payloadForMeasurements(measurements) {
    const table = this.buildStringTable(measurements);
    const strings = Object.keys(table);
    strings.sort();
    const payload = strings;
    payload.unshift(Object.keys(table).length);

    for (let m of measurements) {
      this.appendMeasurement(payload, table, m);
    }
    return payload;
  }

  registryMeasurements() {
    return this.registry.measurements().filter(shouldSend);
  }

  _sendMeasurements(measurements) {
    const log = this.registry.logger;
    const uri = this.registry.config.uri;
    log.debug('Sending ' + measurements.length + ' measurements to ' + uri);
    const payload = this.payloadForMeasurements(measurements);
    this.http.postJson(uri, payload);
    if (log.isLevelEnabled('trace')) {
      for (const m of measurements) {
        log.trace(`Sent: ${m.id.key}=${m.v}`);
      }
    }
  }

  sendMetricsNow() {
    const batchSize = this.registry.config.batchSize;
    const measurements = this.registryMeasurements();
    const log = this.registry.logger;
    const uri = this.registry.config.uri;
    const enabled = this.registry.config.isEnabled();

    if (!uri || !enabled) {
      return;
    }

    if (measurements.length === 0) {
      log.debug('No measurements to send');
    } else {
      for (let i = 0; i < measurements.length; i += batchSize) {
        const batch = measurements.slice(i, i + batchSize);
        this._sendMeasurements(batch);
      }
    }
  }
}


/**
 * Registry to manage a set of meters.
 */
class AtlasRegistry {
  /**
   * Creates a new AtlasRegistry with a given config. A config is an object that
   * controls the behavior of this registry:
   *
   *   * uri: URI to use for sending measurements. If not present this registry will not start.
   *
   *   * commonTags: Tags to add to all measurements
   *
   *   * logger: The logger to use for this registry. Should provide: debug, info, error
   *             methods that take a string.
   *
   *   * strictMode: A boolean that specifies whether extra validations should be performed, and whether to
   *                 throw or just log errors.
   *
   *   * gaugePollingFrequency: milliseconds at which to poll meters. Default 10000.
   *
   *   * frequency: milliseconds at which we send updates to our aggregator. Default 5000.
   *
   *   @param {Object} config Configuration settings. See above.
   */
  constructor(config) {
    this.config = config || {};
    if (!this.config.gaugePollingFrequency) {
      this.config.gaugePollingFrequency = 10000;
    }
    if (!this.config.strictMode) {
      this.config.strictMode = false; // replace undefined with false
    }
    if (!this.config.isEnabled) {
      this.config.isEnabled = () => true;
    }
    if (!this.config.batchSize) {
      this.config.batchSize = 10000;
    }

    this.metersMap = new Map();
    this.state = new Map();
    this.started = false;
    this.publisher = new Publisher(this);
    this.logger = this.config.logger || getLoggers(this.config.logLevel);
    let commonTags = this.config.commonTags;

    if (!commonTags) {
      this.commonTags = new Map();
    } else if (commonTags instanceof Map) {
      this.commonTags = commonTags;
    } else {
      // assume object
      this.commonTags = new Map();

      for (const key of Object.keys(commonTags)) {
        this.commonTags.set(key, commonTags[key]);
      }
    }
  }

  /**
   * Checks whether the newMeter and registeredMeter have the same type.
   * If the registered * was configured to use strictMode then this method
   * will throw if the types are not compatible.
   *
   * @param {Object} registeredMeter the previously registered meter
   * @param {Object} newMeter meter we are currently trying to register
   * @return {boolean} whether the types are compatible
   * @private
   */
  _hasCorrectType(registeredMeter, newMeter) {
    const actualClass = registeredMeter.constructor.name;
    const expectedClass = newMeter.constructor.name;
    let msg;
    if (actualClass !== expectedClass) {
      const idStr = registeredMeter.id.key;
      msg = `Expecting a different type when creating a ${expectedClass} for id=${idStr}. ` +
        `Found ${actualClass} already registered with the same id when ` +
        `${expectedClass} was expected`;
      if (this.config.strictMode) {
        throw new Error(msg);
      } else {
        this.logger.error(msg);
      }
      return false;
    }

    return true;
  }

  /**
   * Throws or logs an error due to an incompatible meter trying to be registered. If running
   * under strictMode this method will throw an Error, otherwise it will log an error
   * message using the registry's logger.
   *
   * @param {MeterId} id Meter id of the meter trying to be registered
   * @param {string} registeredType type already in the registry
   * @param {string} newType attempted type to be registered
   * @param {Object} requestedMeter the meter that caused the error
   * @return {undefined}
   */
  throwTypeError(id, registeredType, newType, requestedMeter) {
    let article;
    const firstLetter = newType.substr(0, 1).toLowerCase();
    if (['a', 'e', 'i', 'o', 'u'].indexOf(firstLetter) >= 0) {
      article = 'an';
    } else {
      article = 'a';
    }

    const msg = `When creating an instance of ${requestedMeter} with id=${id.key}, ` +
      `found a ${registeredType} but was expecting ${article} ${newType}`;
    if (this.config.strictMode) {
      throw new Error(msg);
    } else {
      this.logger.error(msg);
    }
  }

  /**
   * Determine whether the start method of this registry should do work.
   *
   * @return {boolean} Value indicating whether start should proceed, or just do nothing.
   * @private
   */
  _shouldStart() {
    const log = this.logger;

    if (this.started) {
      log.info('Ignoring start request. Spectator registry already started');
      return false;
    }

    const uri = this.config.uri;

    if (!uri) {
      log.info('Ignoring start request since Spectator does ' +
        'not have a valid publish uri configured.');
      return false;
    }

    return true;
  }

  /**
   * Start collecting and sending metrics to an atlas-aggregator service.
   * @return {undefined}
   */
  start() {
    const c = this.config;

    if (!this._shouldStart()) {
      return;
    }

    this.logger.info('Starting spectator registry');
    this.started = true;
    this.startId = setInterval(AtlasRegistry._publish, c.frequency || 5000, this);
    this.startId.unref();
  }

  /**
   * Adds a new meter to this registry if needed, otherwise it returns the existing meter.
   *
   * @param {MeterId} id of the requested meter
   * @param {*} Class class of the requested meter. It assumes it has a constructor that takes an id.
   * @return {*} A meter of class `Class`
   * @private
   */
  _newMeter(id, Class) {
    const key = id.key;
    const meter = new Class(id);

    const m = this.metersMap.get(key);
    if (m) {
      if (this._hasCorrectType(m, meter)) {
        return m;
      }
      // wrong type registered, return a dummy meter not associated
      // with the registry (if running under strictMode _hasCorrectType throws)
      return meter;
    }

    this.metersMap.set(key, meter);
    return meter;
  }

  /**
   * Gets an id from a base id or name and optional additonal tags.
   *
   * @param {*} nameOrId either a string or a base id
   * @param {*} tags an object or Map with tags
   * @return {MeterId} A new MeterId
   * @private
   */
  _getId(nameOrId, tags) {
    if (nameOrId.constructor.name === 'MeterId') {
      return nameOrId.withTags(tags);
    }
    return this.createId(nameOrId, tags);
  }

  /**
   * Measures the rate of some activity. A counter is for continuously incrementing sources like
   * the number of requests that are coming into a server.
   *
   * @param {*} nameOrId either a string with a name, or a base id
   * @param {*} tags an object or Map with tags
   * @return {Counter} A counter that is registered with this registry.
   */
  counter(nameOrId, tags) {
    const meterId = this._getId(nameOrId, tags);
    return this._newMeter(meterId, Counter);
  }

  /**
   * Measures the rate and variation in amount for some activity. For example, it could be used to
   * get insight into the variation in response sizes for requests to a server.
   *
   * @param {*} nameOrId either a string with a name, or a base id
   * @param {*} tags an object or Map with tags
   * @return {DistributionSummary} A distribution summary that is registered with this registry.
   */
  distributionSummary(nameOrId, tags) {
    const meterId = this._getId(nameOrId, tags);
    return this._newMeter(meterId, DistributionSummary);
  }

  /**
   * Represents a value sampled from another source. For example, the size of queue. The caller
   * is responsible for sampling the value regularly and calling its set() method.
   * If you do not want to worry about the sampling, then use {@link PolledMeter}
   * instead.
   *
   * @param {*} nameOrId either a string with a name, or a base id
   * @param {*} tags an object or Map with tags
   * @return {Gauge} A gauge that is registered with this registry.
   */
  gauge(nameOrId, tags) {
    const meterId = this._getId(nameOrId, tags);
    return this._newMeter(meterId, Gauge);
  }

  /**
   * Measures the rate and time taken for short running tasks.
   *
   * @param {*} nameOrId either a string with a name, or a base id
   * @param {*} tags an object or Map with tags
   * @return {Timer} A timer that is registered with this registry.
   */
  timer(nameOrId, tags) {
    const meterId = this._getId(nameOrId, tags);
    return this._newMeter(meterId, Timer);
  }


  // publish metrics now
  static _publish(self) {
    self.publisher.sendMetricsNow();
  }

  // removes the previous state
  // ensuring that any registered intervals are cleared
  _clearState() {
    for (let v of this.state.values()) {
      if (v.interval) {
        clearInterval(v.interval);
        v.interval = undefined;
      }
    }
    this.state = new Map();
  }

  /**
   * Stop background activity. This includes sending metrics to an atlas
   * aggregator service and polling of meters.
   *
   * @return {undefined}
   */
  stop() {
    const log = this.logger;

    log.info('Stopping spectator registry');
    this.started = false;
    clearInterval(this.startId);
    this.startId = undefined;
    AtlasRegistry._publish(this);

    this._clearState();
  }


  /**
   * Get an array of measurements.
   * @return {Array}
   *   An array consisting of all measurements that were produced
   *   by our registered meters.
   */
  measurements() {
    let a = [];

    for (let meter of this.metersMap.values()) {
      a = a.concat(meter.measure());
    }
    return a;
  }

  /**
   * Get an array of registered meters.
   * @return {any[]} An array consisting of all meters currently registered.
   */
  meters() {
    return Array.from(this.metersMap.values());
  }


  /**
   * Creates an identifier for a meter.
   *
   * @param {string} name Description of the measurement that is being collected.
   * @param {*} tags Other dimensions that can be used to classify the measurement.
   * @return {MeterId} A new meter id.
   */
  createId(name, tags) {
    if (this.config.strictMode) {
      MeterId.validate(name, tags);
    }
    return new MeterId(name, tags);
  }

  /**
   * Schedule a task periodically.  See setInterval()
   *
   * @param {*} args - Arguments delegated to setInterval
   * @returns {Object} A timeout for use with clearInterval
   */
  schedulePeriodically(args) {
    const id = setInterval.apply(this, arguments);
    id.unref();
    return id;
  }

  /**
   * High resolution timer.
   *
   * @param {number[]} [time] - The result of a previous call to registry.hrtime()
   * @return {number[]} - [seconds, nanoseconds]
   */
  hrtime(time) {
    return process.hrtime(time);
  }
}


const ADD_OP = 0;
const MAX_OP = 10;
const UNKNOWN_OP = -1;
const opsForStats = {
  count: ADD_OP,
  totalAmount: ADD_OP,
  totalTime: ADD_OP,
  totalOfSquares: ADD_OP,
  percentile: ADD_OP,
  max: MAX_OP,
  gauge: MAX_OP,
  activeTasks: MAX_OP,
  duration: MAX_OP,
  unknown: UNKNOWN_OP
};

function opForMeasurement(measure) {
  const stat = measure.id.tags.get('statistic') || 'unknown';
  const op = opsForStats[stat];

  if (op !== undefined) {
    return op;
  }
  return UNKNOWN_OP;
}

function shouldSend(measure) {
  const op = opForMeasurement(measure);

  if (op === ADD_OP) {
    return measure.v > 0;
  }

  if (op === MAX_OP) {
    return !Number.isNaN(measure.v);
  }
  return false;
}

module.exports = AtlasRegistry;
