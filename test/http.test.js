'use strict';

const chai = require('chai');
const assert = chai.assert;

const AtlasRegistry = require('../src/registry');
const HttpClient = require('../src/http');
const express = require('express');
const bodyParser = require('body-parser');

describe('http client', () => {
  it('should post JSON updating a timer', (done) => {
    const r = new AtlasRegistry();
    const h = new HttpClient(r);
    const server = express();
    server.use(bodyParser.json({
      type: 'application/json',
      limit: '8mb'
    }));
    server.post('/json', (req, res) => {
      const payload = req.body;
      res.send(JSON.stringify({
        ok: 1
      }));
      res.end();
      assert.deepEqual({foo: 'bar'}, payload);
      setTimeout(() => {
        const measurements = r.measurements();
        console.log(`Got ${measurements.length} measurements`);
        let timerCount = 0;

        for (let m of measurements) {
          const name = m.id.name;

          if (name === 'http.req.complete') {
            ++timerCount;
            assert.equal(m.id.tags.get('status'), '2xx');
            assert.equal(m.id.tags.get('statusCode'), '200');
          }
        }
        assert.equal(timerCount, 4);
        done();
      }, 10);
    });

    const listener = server.listen(() => {
      const port = listener.address().port;
      console.log('Listening on ' + port);
      h.postJson('http://localhost:' + port + '/json',
        {foo: 'bar'});
    });
  });

  it('handle 5xx', (done) => {
    const r = new AtlasRegistry();
    const h = new HttpClient(r);
    const server = express();
    server.use(bodyParser.json({
      type: 'application/json',
      limit: '8mb'
    }));
    server.post('/json', (req, res) => {
      const payload = req.body;
      res.status(503);
      res.send(JSON.stringify({
        err: 1
      }));
      res.end();
      assert.deepEqual({foo: 'bar'}, payload);
      setTimeout(() => {
        const measurements = r.measurements();
        console.log(`Got ${measurements.length} measurements`);
        let timerCount = 0;

        for (let m of measurements) {
          const name = m.id.name;

          if (name === 'http.req.complete') {
            ++timerCount;
            assert.equal(m.id.tags.get('status'), '5xx');
            assert.equal(m.id.tags.get('statusCode'), '503');
          }
        }
        assert.equal(timerCount, 4);
        done();
      }, 10);
    });

    const listener = server.listen(() => {
      const port = listener.address().port;
      console.log('Listening on ' + port);
      h.postJson('http://localhost:' + port + '/json',
        {foo: 'bar'});
    });
  });

  it('handle timeout errors', (done) => {
    const r = new AtlasRegistry({timeout: 10}); // 10ms timeout
    const h = new HttpClient(r);
    const server = express();
    server.use(bodyParser.json({
      type: 'application/json',
      limit: '8mb'
    }));

    function handleRequestLater(req, res) {
      res.status(503);
      res.send(JSON.stringify({
        err: 1
      }));
      res.end();
      setTimeout(() => {
        const measurements = r.measurements();
        let timerCount = 0;

        for (let m of measurements) {
          const name = m.id.name;

          if (name === 'http.req.complete') {
            ++timerCount;
            assert.equal(m.id.tags.get('status'), 'timeout');
            assert.equal(m.id.tags.get('statusCode'), 'timeout');
          }
        }
        assert.equal(timerCount, 4);
        done();
      }, 10);
    }

    server.post('/json', (req, res) => {
      setTimeout(handleRequestLater, 100, req, res);
    });

    const listener = server.listen(() => {
      const port = listener.address().port;
      console.log('Listening on ' + port);
      h.postJson('http://localhost:' + port + '/json',
        {foo: 'bar'});
    });
  });

  it('handle hostname errors', (done) => {
    const r = new AtlasRegistry();
    const h = new HttpClient(r);
    const server = express();
    server.use(bodyParser.json({
      type: 'application/json',
      limit: '8mb'
    }));

    h.postJson('http://foo.example.org/', {foo: 'bar'});
    setTimeout(() => {
      const measurements = r.measurements();
      console.log(`Got ${measurements.length} measurements`);

      for (let m of measurements) {
        if (m.id.name === 'http.req.complete') {
          assert.equal(m.id.tags.get('status'), 'ENOTFOUND');
          assert.equal(m.id.tags.get('statusCode'), 'ENOTFOUND');
        }
      }
      done();
    }, 100);
  });
});
