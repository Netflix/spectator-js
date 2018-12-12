'use strict';

const MeterId = require('./meter_id');
const Counter = require('./counter');
const Gauge = require('./gauge');
const Timer = require('./timer');
const DistributionSummary = require('./dist_summary');
const HttpClient = require('./http');

class SimpleLogger {
  info() {
    arguments[0] = 'INFO: ' + arguments[0];
    console.log.apply(console, arguments);
  }

  debug() {
    arguments[0] = 'DEBUG: ' + arguments[0];
    console.log.apply(console, arguments);
  }

  error() {
    arguments[0] = 'ERROR: ' + arguments[0];
    console.log.apply(console, arguments);
  }
}

// internal class used to publish measurements to an aggregator service
class Publisher {
  constructor(registry) {
    this.registry = registry;
    this.frequency = registry.config.frequency || 5;
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

  sendMetricsNow() {
    const ms = this.registryMeasurements();
    const log = this.registry.logger;
    const uri = this.registry.config.uri;
    if (!uri) {
      return;
    }

    if (ms.length === 0) {
      log.debug('No measurements to send');
    } else {
      const payload = this.payloadForMeasurements(ms);
      log.info('Sending ' + ms.length + ' measurements to ' + uri);
      this.http.postJson(uri, payload);
    }
  }

}

class AtlasRegistry {
  constructor(config) {
    this.config = config || {};
    if (!this.config.gaugePollingFrequency) {
      this.config.gaugePollingFrequency = 10000;
    }
    if (!this.config.strictMode) {
      this.config.strictMode = false; // replace undefined with false
    }

    this.metersMap = new Map();
    this.state = new Map();
    this.started = false;
    this.publisher = new Publisher(this);
    this.logger = this.config.logger || new SimpleLogger();
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

  hasCorrectType(id, registeredMeter, newMeter) {
    const actualClass = registeredMeter.constructor.name;
    const expectedClass = newMeter.constructor.name;
    let msg;
    if (actualClass !== expectedClass) {
      msg = `Expecting a different type when creating a ${expectedClass} for id=${id.key}. ` +
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

  throwTypeError(id, registeredType, newType, requestedMeter) {
    const msg = `When creating an instance of ${requestedMeter} with id=${id.key}, ` +
      `found a ${registeredType} but was expecting a ${newType}`;
    if (this.config.strictMode) {
      throw new Error(msg);
    } else {
      this.logger.error(msg);
    }
  }

  shouldStart() {
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

  start() {
    const c = this.config;

    if (!this.shouldStart()) {
      return;
    }

    this.logger.info('Starting spectator registry');
    this.started = true;
    this.startId = setInterval(this.publish, c.frequency || 5000, this);
  }

  newMeter(id, Clazz) {
    const key = id.key;
    const meter = new Clazz(id);

    const m = this.metersMap.get(key);
    if (m) {
      if (this.hasCorrectType(id, m, meter)) {
        return m;
      }
      // wrong type registered, return a dummy meter not associated
      // with the registry (if running under strictMode hasCorrectType throws)
      return meter;
    }

    this.metersMap.set(key, meter);
    return meter;
  }

  _getId(nameOrId, tags) {
    if (nameOrId.constructor.name === 'MeterId') {
      return nameOrId.withTags(tags);
    }
    return this.newId(nameOrId, tags);
  }

  counter(nameOrId, tags) {
    const meterId = this._getId(nameOrId, tags);
    return this.newMeter(meterId, Counter);
  }

  gauge(nameOrId, tags) {
    const meterId = this._getId(nameOrId, tags);
    return this.newMeter(meterId, Gauge);
  }

  timer(nameOrId, tags) {
    const meterId = this._getId(nameOrId, tags);
    return this.newMeter(meterId, Timer);
  }

  distributionSummary(nameOrId, tags) {
    const meterId = this._getId(nameOrId, tags);
    return this.newMeter(meterId, DistributionSummary);
  }

  publish(self) {
    self.publisher.sendMetricsNow();
  }

  _clearStateUpdates() {
    for (let v of this.state.values()) {
      if (v.interval) {
        clearInterval(v.interval);
        v.interval = undefined;
      }
    }
    this.state = new Map();
  }

  stop() {
    const log = this.logger;

    log.info('Stopping spectator registry');
    this.started = false;
    clearInterval(this.startId);
    this.startId = undefined;
    this.publish(this);

    this._clearStateUpdates();
  }

  measurements() {
    let a = [];

    for (let meter of this.metersMap.values()) {
      a = a.concat(meter.measure());
    }
    return a;
  }

  meters() {
    return Array.from(this.metersMap.values());
  }

  newId(name, tags) {
    if (this.config.strictMode) {
      MeterId.validate(name, tags);
    }
    return new MeterId(name, tags);
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
