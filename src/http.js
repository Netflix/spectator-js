'use strict';

const http = require('http');
const URL = require('url');

const headers = {
  'Content-Type': 'application/json'
};
class HttpClient {
  constructor(registry) {
    this.registry = registry;
  }

  postJson(endpoint, payload) {
    const log = this.registry.logger;
    const url = URL.parse(endpoint);

    const baseId = this.registry.newId('http.req.complete',
      {method: 'POST', mode: 'http-client', client: 'spectator-js'});
    const jsonStr = JSON.stringify(payload);
    headers['Content-length'] = Buffer.byteLength(jsonStr);
    const options = {
      headers: headers,
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      method: 'POST',
      protocol: url.protocol
    };

    const start = process.hrtime();
    const self = this;
    const request = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const statusFamily = `${Math.floor(res.statusCode / 100)}xx`;
        const timerId = baseId.withTags({statusCode: res.statusCode, status: statusFamily});
        self.registry.timer(timerId).record(process.hrtime(start));

        if (statusFamily !== '2xx') {
          log.error(`POST to ${endpoint}: ${res.statusCode} - ${data}`);
        }
      });
    });

    request.on('error', (e) => {
      let error = e.code;

      if (error === 'ECONNRESET') {
        error = 'timeout';
      } else {
        // our timeout handler handles logging the error, so no need to duplicate
        // the error message
        log.error(`problem with request: ${e.message}`);
      }
      self.registry.timer(baseId, {statusCode: error, status: error})
        .record(process.hrtime(start));
    });

    const timeout = this.registry.config.timeout || 1000;
    request.setTimeout(timeout, () => {
      request.abort();
      const elapsed = process.hrtime(start);
      const seconds = elapsed[0] + elapsed[1] / 1e9;
      log.error(`Timeout POSTing to ${endpoint} after ${seconds.toFixed(2)}s`);
    });
    request.write(jsonStr);
    request.end();
  }
}

module.exports = HttpClient;
