[![Snapshot](https://github.com/Netflix/spectator-js/actions/workflows/snapshot.yml/badge.svg)](https://github.com/Netflix/spectator-js/actions/workflows/snapshot.yml)
[![Release](https://github.com/Netflix/spectator-js/actions/workflows/release.yml/badge.svg)](https://github.com/Netflix/spectator-js/actions/workflows/release.yml)

# Spectator-js

Client library for instrumenting applications using a dimensional data model.

## Description

This module can be used to instrument an application using timers, gauges,
counters, distribution summaries, long task timers, and more complex meter
types (like bucket or percentile timers) using a dimensional data model. 

The generated metrics are periodically sent to an
[Atlas](https://github.com/Netflix/atlas) Aggregator.

To add Node.js runtime metrics, couple this module with the 
[Spectator Nodemetrics](https://github.com/Netflix-Skunkworks/spectator-js-nodejsmetrics)
module.

## Instrumenting Code

```javascript
'use strict';

const spectator = require('nflx-spectator');

// Netflix applications can use the spectator configuration node module available
// internally through artifactory to generate the config required by nflx-spectator
function getConfig() {
  return {
    commonTags: {'nf.node': 'i-1234'},
    uri: 'http://atlas.example.org/v1/publish',
    timeout: 1000 // milliseconds 
  }
}

class Response {
  constructor(status, size) {
    this.status = status;
    this.size = size;
  }
}

class Server {
  constructor(registry) {
    this.registry = registry;
    // create a base Id, to which we'll add some dynamic tags later
    this.requestCountId = registry.createId('server.requestCount', {version: 'v1'});
    this.requestLatency = registry.timer('server.requestLatency');
    this.responseSize = registry.distributionSummary('server.responseSizes');
  }
  
  handle(request) {
    const start = this.registry.hrtime();
    
    // do some work based on request and obtain a response
    const res = new Response(200, 64);
    
    // update the counter id with dimensions based on the request. The
    // counter will then be looked up in the registry which should be 
    // fairly cheap, such as a lookup of an id object in a map
    // However, it is more expensive than having a local variable set
    // to the counter
    const counterId = this.requestCountId.withTags({country: request.country, 
        status: res.status});
    this.registry.counter(counterId).increment();
    this.requestLatency.record(this.registry.hrtime(start));
    this.responseSize.record(res.size);
    return res;
  }
}

const config = getConfig();
const registry = new spectator.Registry(config);

class Request {
  constructor(country) {
    this.country = country;
  }
}

// somehow get a request from the user...
function getNextRequest() {
  return new Request('AR');
}

function handleTermination() {
  registry.stop();
}

process.on('SIGINT', handleTermination);
process.on('SIGTERM', handleTermination);

registry.start();

const server = new Server(registry);

for (let i = 0; i < 3; ++i) {
  const req = getNextRequest();
  server.handle(req)
}

registry.stop();
```
