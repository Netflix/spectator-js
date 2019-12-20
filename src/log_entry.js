'use strict';

const PercentileTimer = require('./percentile_timer');

class LogEntry {
  /**
   * @constructor
   * @param {AtlasRegistry} registry spectator registry instance
   * @param {string} method GET | POST, etc.
   * @param {string} url URL used as the destination for the method
   */
  constructor(registry, method, url) {
    this.registry = registry;
    this.start = registry.hrtime();
    const tags = {
        owner: 'spectator-js',
        'ipc.endpoint': pathFromUrl(url),
        'http.method': method,
        'http.status': '-1'
      };
    this.id = registry.createId('ipc.client.call', tags);
  }

  /**
   * Update a percentile timer based on the current log entry
   * @return {void}
   */
  log() {
    new PercentileTimer.Builder(this.registry)
      .withId(this.id)
      .withRangeMilliseconds(1, 5000).build()
      .record(this.registry.hrtime(this.start));
  }

  /**
   * Set the http status code for this log entry
   *
   * @param {number} code http status code
   * @return {void}
   */
  setStatusCode(code) {
    this.id = this.id.withTag('http.status', code.toString());
  }

  /**
   * Record the attempt number for the request, and whether it is final
   *
   * @param {number} attemptNumber Attempt number
   * @param {boolean} final Whether this is the final request, or more retries are expected
   * @return {void}
   */
  setAttempt(attemptNumber, final) {
    this.id = this.id.withTag('ipc.attempt', attempt(attemptNumber))
      .withTag('ipc.attempt.final', final.toString());
  }

  /**
   * Mark the entry as an error
   *
   * @param {string} error Error type (should be a single word)
   * @return {void}
   */
  setError(error) {
    this.id = this.id.withTag('ipc.result', 'failure').withTag('ipc.status', error);
  }

  /**
   * Mark the entry as successful
   * @return {void}
   */
  setSuccess() {
    const ipcSuccess = 'success';
    this.id = this.id.withTag('ipc.result', ipcSuccess).withTag('ipc.status', ipcSuccess);
  }
}

/**
 * Get the string representation of an attempt number
 * @param {Number} attemptNumber Attempt number
 * @return {string} Representation of the attempt number
 */
function attempt(attemptNumber) {
  switch (attemptNumber) {
    case 0:
      return 'initial';
    case 1:
      return 'second';
    default:
      return 'third_up';
  }
}

function pathFromUrl(url) {
  if (url.length === 0) {
    return '/';
  }

  const protoEnd = url.indexOf(':');
  if (protoEnd < 0) {
    // no protocol, assume just a path
    return url;
  }

  const protocolLen = url.length - protoEnd;
  if (protocolLen < 3) {
    return url;
  }

  // find the path, skipping over protocol://
  const pathBegin = url.indexOf('/', protoEnd + 3);
  if (pathBegin < 0) {
    return '/';
  }

  const queryBegin = url.indexOf('?', pathBegin + 1);
  if (queryBegin < 0) {
    // no query component
    return url.substring(pathBegin);
  }

  return url.substring(pathBegin, queryBegin);
}

module.exports = LogEntry;
