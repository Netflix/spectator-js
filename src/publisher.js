/**
 * @module publisher
 */
'use strict';

const HttpClient = require('./http');
const async = require('async');

/**
 * internal class used to publish measurements to an aggregator service
 *
 * @class Publisher
 * @protected
 */
class Publisher {
  /**
   * @constructor
   * @param {AtlasRegistry} registry spectator registry instance
   */
  constructor(registry) {
    this.registry = registry;
    this.http = new HttpClient(registry);
  }

  /**
   * Build a string table from the list of measurements
   * Unique words are identified, and assigned a number starting from 0 based
   * on their lexicographical order
   *
   * @param {object[]} measurements measurements to be published
   * @return {object}
   */
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

  /**
   * mutates the payload parameter with measurements
   *
   * @param {any[]} payload request payload
   * @param {object} table string table
   * @param {object} measure measure to be added to the payload
   * @return {void}
   */
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

  /**
   *
   * @param {object[]} measurements measurements to be published
   * @return {any[]}
   */
  payloadForMeasurements(measurements) {
    const table = this.buildStringTable(measurements);
    const strings = Object.keys(table);
    strings.sort();

    const payload = [].concat(strings.length, strings);
    for (let m of measurements) {
      this.appendMeasurement(payload, table, m);
    }
    return payload;
  }

  /**
   * gets measurements
   * @return {object[]}
   */
  registryMeasurements() {
    return this.registry.measurements().filter(shouldSend);
  }

  /**
   * makes http request to spectator and sends accumulated measurements
   * @private
   * @param {object[]} measurements measurements to be published
   * @param {function(e: Error, res: any): void} [cb = ()=> {}] callback function
   * @return {void}
   */
  _sendMeasurements(measurements, cb = () => {}) {
    const log = this.registry.logger;
    const uri = this.registry.config.uri;
    log.debug('Sending ' + measurements.length + ' measurements to ' + uri);
    const payload = this.payloadForMeasurements(measurements);
    this.http.postJson(uri, payload, cb);
    if (typeof log.isLevelEnabled === 'function' && log.isLevelEnabled('trace')) {
      for (const m of measurements) {
        log.trace(`Sent: ${m.id.key}=${m.v}`);
      }
    }
  }

  /**
   * flushes accumulated measurements
   * @param {function(e: Error, res: any): void} [cb = ()=> {}] callback function
   * @return {void}
   */
  sendMetricsNow(cb = () => {}) {
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

      let batches = [];
      for (let i = 0; i < measurements.length; i += batchSize) {
        batches.push(measurements.slice(i, i + batchSize));
      }

      async.map(batches, this._sendMeasurements.bind(this), function(err) {
        cb(err);
      });
    }
  }
}

const ADD_OP = 0;
const MAX_OP = 10;
const counterStats = {
  count: 1,
  totalAmount: 1,
  totalTime: 1,
  totalOfSquares: 1,
  percentile: 1
};

/**
 * @param {object} measure measurement
 * @return {number}
 */
function opForMeasurement(measure) {
  const stat = measure.id.tags.get('statistic') || '';
  if (counterStats[stat]) {
    return ADD_OP;
  }
  return MAX_OP;
}

/**
 * @param {object} measure measurement
 * @return {boolean}
 */
function shouldSend(measure) {
  const op = opForMeasurement(measure);

  if (op === ADD_OP) {
    return measure.v > 0;
  }

  return !Number.isNaN(measure.v);
}

module.exports = Publisher;
