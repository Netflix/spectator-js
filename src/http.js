'use strict';

const needle = require('needle');
const LogEntry = require('./log_entry');

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
    const logEntry = new LogEntry(this.registry, 'POST', endpoint);
    const MAX_ATTEMPTS = 3;

    const options = {
      headers: {
        'Content-Type': 'application/json',
        'Content-length': Buffer.byteLength(jsonStr)
      },
      open_timeout: timeout,
      response_timeout: timeout
    };

    let attemptNumber = 0;

    const metricsHandler = (err, res) => {
      if (err) {
        let error = err.code;

        if (error === 'ECONNRESET') {
          logEntry.setError('timeout');
          log.error(`Timeout POSTing metrics to ${endpoint}`);
        } else {
          log.error(`problem with request: ${err.message}`);
          logEntry.setError(err.code.toString());
        }
        logEntry.setAttempt(attemptNumber, true);
        logEntry.log();

        return cb(err);
      }

      logEntry.setStatusCode(res.statusCode);
      const httpOk = res.statusCode >= 200 && res.statusCode < 300;
      if (httpOk) {
        logEntry.setSuccess();
      } else {
        logEntry.setError('http_error');
      }

      const willRetry = res.statusCode === 503 && attemptNumber < MAX_ATTEMPTS;

      logEntry.setAttempt(attemptNumber, !willRetry);
      logEntry.log();

      const data = res.body;
      if (!httpOk) {
        log.error(`POST to ${endpoint}: ${res.statusCode} - ${data}`);
      }

      if (willRetry) {
        attemptNumber++;
        return needle.post(endpoint, jsonStr, options, metricsHandler);
      }

      return cb(null, res);
    };

    needle.post(endpoint, jsonStr, options, metricsHandler);
  }
}

module.exports = HttpClient;
