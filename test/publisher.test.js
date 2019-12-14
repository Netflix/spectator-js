'use strict';

const chai = require('chai');
const assert = chai.assert;
const AtlasRegistry = require('../src/registry');
const express = require('express');
const bodyParser = require('body-parser');

describe('registry publisher', () => {

  function testMeasurements(statusCode, response, assertCallback, done) {
    const r = new AtlasRegistry({});
    const server = express();
    server.use(bodyParser.json({
      type: 'application/json',
      limit: '8mb'
    }));

    const sendMeasurements = () => {
      const valid1 = r.createId('foo1');
      const valid2 = r.createId('foo1', {key: 'value'});
      const invalid = r.createId('name', {'nf.k': 'foo'});

      r.publisher._sendMeasurements([
        {id: valid1, v: 1.0},
        {id: valid2, v: 2.0},
        {id: invalid, v: 3.0}], () => {
        const ms = r.measurements().filter(m => m.id.name === 'spectator.measurements');
        assertCallback(ms);
      });
    };

    const listener = server.listen(() => {
      const port = listener.address().port;
      console.log(`Waiting for measurements using port ${port}`);
      r.config.uri = `http://localhost:${port}/metrics`;
      sendMeasurements();
    });

    server.post('/metrics', (req, res) => {
      r.logger.trace(`Got measurements payload: ${JSON.stringify(req.body)}`);
      res.status(statusCode);
      res.send(JSON.stringify(response));
      res.end();
      setTimeout(() => {
        listener.close();
        done();
      }, 10);
    });
  }

  it('should generate metrics for valid measurements', (done) => {
    testMeasurements(200, {ok: 1}, (ms) => {
      assert.lengthOf(ms, 1);
      assert.equal(ms[0].id.key, 'spectator.measurements|id=sent|statistic=count');
      assert.equal(ms[0].v, 3);
    }, done);
  });

  it('should generate metrics for partial successes sending measurements', (done) => {
    const partial = {
      type:'partial',
      errorCount:1,
      message:["invalid key for reserved prefix 'nf.': nf.k"]
    };

    testMeasurements(202, partial, (ms) => {
      ms.sort();
      assert.lengthOf(ms, 2);

      assert.equal(ms[0].id.key, 'spectator.measurements|id=sent|statistic=count');
      assert.equal(ms[0].v, 2);
      assert.equal(ms[1].id.key,
        'spectator.measurements|error=validation|id=dropped|statistic=count');
      assert.equal(ms[1].v, 1);
    }, done);
  });

  it('should generate metrics for all invalid measurements', (done) => {
    const invalidReq = {
      type:'error',
      errorCount:3,
      message:["invalid key for reserved prefix 'nf.': nf.nodex",
        "invalid key for reserved prefix 'nf.': nf.nodex",
        "invalid key for reserved prefix 'nf.': nf.nodex"]};

    testMeasurements(400, invalidReq, (ms) => {
      assert.lengthOf(ms, 1);

      assert.equal(ms[0].id.key,
        'spectator.measurements|error=validation|id=dropped|statistic=count');
      assert.equal(ms[0].v, 3);
    }, done);
  });

  it('should generate metrics for server errors', (done) => {
    testMeasurements(500, {}, (ms) => {
      assert.lengthOf(ms, 1);
      assert.equal(ms[0].id.key,
        'spectator.measurements|error=http-error|id=dropped|statistic=count');
      assert.equal(ms[0].v, 3);
    }, done);
  });
});
