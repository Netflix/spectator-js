'use strict';

const needle = require('needle');

class HttpClient {
  /**
   * @constructor
   * @param {AtlasRegistry} registry spectator registry instance
   */
  constructor(registry) {
    this.registry = registry;

    this.baseId = registry.createId('http.req.complete', {
      method: 'POST',
      mode: 'http-client',
      client: 'spectator-js'
    });
  }

  /**
   * @param {string} endpoint spectator uri
   * @param {object} payload batch of metrics
   * @param {function(e: Error, res: any): void} [cb = ()=> {}] callback function
   * @return {void}
   */
  postJson(endpoint, payload, cb = () => {}) {
    const log = this.registry.logger;
    const jsonStr = JSON.stringify(payload);
    const timeout = this.registry.config.timeout || 1000;

    const options = {
      headers: {
        'Content-Type': 'application/json',
        'Content-length': Buffer.byteLength(jsonStr)
      },
      open_timeout: timeout,
      response_timeout: timeout
    };

    const registry = this.registry;
    const start = registry.hrtime();

    needle.post(endpoint, jsonStr, options, (err, res) => {
      if (err) {
        let error = err.code;

        if (error === 'ECONNRESET') {
          error = 'timeout';
          log.error(`Timeout POSTing metrics to ${endpoint}`);
        } else {
          log.error(`problem with request: ${err.message}`);
        }
        registry.timer(this.baseId, {
          statusCode: error,
          status: error
        }).record(registry.hrtime(start));

        return cb(err);
      }

      const data = res.body;
      const statusFamily = `${Math.floor(res.statusCode / 100)}xx`;
      const timerId = this.baseId.withTags({statusCode: res.statusCode, status: statusFamily});
      registry.timer(timerId).record(registry.hrtime(start));

      if (statusFamily !== '2xx') {
        log.error(`POST to ${endpoint}: ${res.statusCode} - ${data}`);
      }
      return cb(null, res);
    });
  }
}

module.exports = HttpClient;
