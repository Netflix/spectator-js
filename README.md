[![Build Status](https://travis-ci.org/Netflix/spectator-js.svg?branch=master)](https://travis-ci.org/Netflix/spectator-js) 
[![codecov](https://codecov.io/gh/Netflix/spectator-js/branch/master/graph/badge.svg)](https://codecov.io/gh/Netflix/spectator-js)

# Spectator-js

> :warning: Experimental

Simple library for instructing code to record dimentional time series.

## Description

This implements a basic [Spectator](https://github.com/Netflix/spectator) library
for instrumenting nodejs applications, sending metrics to an Atlas aggregator service.

## Instrumenting Code

```javascript
'use strict';

function getConfig() {
  return {
    commonTags: {'nf.node': 'i-1234'},
    uri: 'http://atlas.example.org/v1/publish',
    timeout: 1000 // milliseconds 
  }
}

const spectator = require('nflx-spectator');

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
    this.requestCountId = registry.newId('server.requestCount', {version: 'v1'});
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
const registry = spectator.newRegistry(config);

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
