'use strict';

const Publisher = require('./publisher');
const MeterId = require('./meter_id');
const Counter = require('./counter');
const Gauge = require('./gauge');
const Timer = require('./timer');
const DistributionSummary = require('./dist_summary');
const IntervalCounter = require('./interval_counter');
const PercentileTimer = require('./percentile_timer');
const PercentileDistSummary = require('./percentile_dist_summary');
const BucketCounter = require('./bucket_counter');
const BucketTimer = require('./bucket_timer');
const BucketDistSummary = require('./bucket_dist_summary');
const getLoggers = require('./logger');

/**
 * Registry to manage a set of meters.
 * @class AtlasRegistry
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
   *   * publisher: optional instance of Publisher.
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
    if (!this.config.connectOptions) {
      this.config.connectOptions = (options) => options;
    }
    if (!this.config.batchSize) {
      this.config.batchSize = 10000;
    }

    this.metersMap = new Map();
    this.state = new Map();
    this.started = false;
    this.publisher = this.config.publisher || new Publisher(this);
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
   * @param {Object} expectedClass class of meter we are currently trying to register
   * @return {boolean} whether the types are compatible
   * @private
   */
  _hasCorrectType(registeredMeter, expectedClass) {
    if (!(registeredMeter instanceof expectedClass)) {
      const idStr = registeredMeter.id.key;
      const className = expectedClass.name;
      const msg = `Expecting a different type when creating a ${className} for id=${idStr}. ` +
        `Found ${registeredMeter.constructor.name} already registered with the same id when ` +
        `${className} was expected`;

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
   * @return {void}
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
   * @return {void}
   */
  start() {
    const c = this.config;

    if (!this._shouldStart()) {
      return;
    }

    this.logger.info(`Starting spectator registry with config: ${JSON.stringify(c)}`);
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

    const m = this.metersMap.get(key);
    // if running under strictMode _hasCorrectType throws
    if (m && this._hasCorrectType(m, Class)) {
      return m;
    }

    const meter = new Class(id);

    // if wrong type registered, return a dummy meter not associated with the registry
    if (!m) {
      // otherwise add it to the registry meter map
      this.metersMap.set(key, meter);
    }

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
    if (nameOrId instanceof MeterId) {
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
   * Measures the rate of some activity. A counter is for continuously incrementing sources like
   * the number of requests that are coming into a server.
   *
   * @deprecated Use counter instead. This is kept for backwards compatibility only
   *
   * @param {*} nameOrId either a string with a name, or a base id
   * @param {*} tags an object or Map with tags
   * @return {Counter} A counter that is registered with this registry.
   */
  dcounter(nameOrId, tags) {
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
   * Measures the rate and variation in amount for some activity. For example, it could be used to
   * get insight into the variation in response sizes for requests to a server.
   *
   * @deprecated Use distributionSummary instead. This is kept for backwards compatibility only
   *
   * @param {*} nameOrId either a string with a name, or a base id
   * @param {*} tags an object or Map with tags
   * @return {DistributionSummary} A distribution summary that is registered with this registry.
   */
  distSummary(nameOrId, tags) {
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

  intervalCounter(nameOrId, tags) {
    const meterId = this._getId(nameOrId, tags);
    return IntervalCounter.get(this, meterId);
  }

  percentileTimer(nameOrId, tags) {
    const meterId = this._getId(nameOrId, tags);
    return PercentileTimer.get(this, meterId);
  }

  percentileDistSummary(nameOrId, tags) {
    const meterId = this._getId(nameOrId, tags);
    return PercentileDistSummary.get(this, meterId);
  }

  _bucketMeter(nameOrId, tags, bucketFunction, Class) {
    let fun, id;
    if (typeof tags === 'function') {
      fun = tags;
      id = this._getId(nameOrId, {});
    } else {
      id = this._getId(nameOrId, tags);
      fun = bucketFunction;
    }
    return Class.get(this, id, fun);
  }

  bucketTimer(nameOrId, tags, bucketFunction) {
    return this._bucketMeter(nameOrId, tags, bucketFunction, BucketTimer);
  }

  bucketCounter(nameOrId, tags, bucketFunction) {
    return this._bucketMeter(nameOrId, tags, bucketFunction, BucketCounter);
  }

  bucketDistSummary(nameOrId, tags, bucketFunction) {
    return this._bucketMeter(nameOrId, tags, bucketFunction, BucketDistSummary);
  }

  /**
   * publish metrics now
   * @static
   * @private
   * @param {AtlasRegistry} self registry instance
   * @param {function(e: Error, res: any): void} [cb = ()=> {}] callback function
   * @return {void}
   */
  static _publish(self, cb) {
    self.publisher.sendMetricsNow(cb);
  }

  /**
   * removes the previous state ensuring that any registered intervals are cleared
   * @private
   * @return {void}
   */
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
   * @param {function(e: Error, res: any): void} [cb = ()=> {}] callback function
   * @return {undefined}
   */
  stop(cb) {
    const log = this.logger;

    log.info('Stopping spectator registry');
    this.started = false;
    clearInterval(this.startId);
    this.startId = undefined;
    AtlasRegistry._publish(this, cb);

    this._clearState();
  }


  /**
   * Get an array of measurements.
   * @return {Array}
   *   An array consisting of all measurements that were produced
   *   by our registered meters.
   */
  measurements() {
    // meter.measure() returns an array of up to 4 items,
    // so pre-allocate the max size and trim down at the end
    let a = new Array(this.metersMap.size * 4);
    let len = 0;

    for (let meter of this.metersMap.values()) {
      const measures = meter.measure();
      for (let m of measures) {
        a[len] = m;
        len++;
      }
    }
    // Slice off any trailing empty values
    return Array.prototype.slice.call(a, 0, len);
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


module.exports = AtlasRegistry;
