'use strict';

const chai = require('chai');
const assert = chai.assert;

const AtlasRegistry = require('../src/registry');
const HttpClient = require('../src/http');
const express = require('express');
const bodyParser = require('body-parser');

describe('http client', () => {

  function getServer() {
    const server = express();
    server.use(bodyParser.json({
      type: 'application/json',
      limit: '8mb'
    }));
    return server;
  }

  it('should post JSON updating a timer', (done) => {
    const r = new AtlasRegistry();
    const h = new HttpClient(r);
    const server = getServer();

    const listener = server.listen(() => {
      const port = listener.address().port;
      console.log(`Listening on ${port}`);
      h.postJson('http://localhost:' + port + '/foo-endpoint',
        {foo: 'bar'});
    });

    server.post('/foo-endpoint', (req, res) => {
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
          if (name !== 'ipc.client.call') {
            assert.fail(name, 'ipc.client.call', `Unexpected measurement: ${m.id.key}`);
          } else {
            ++timerCount;
            assert.equal(m.id.tags.get('ipc.result'), 'success');
            assert.equal(m.id.tags.get('http.status'), '200');
            assert.equal(m.id.tags.get('ipc.endpoint'), '/foo-endpoint');
          }
        }
        assert.equal(timerCount, 5);
        listener.close();
        done();
      }, 10);
    });
  });

  it('handle 5xx', (done) => {
    const r = new AtlasRegistry();
    const h = new HttpClient(r);
    const server = getServer();

    const listener = server.listen(() => {
      const port = listener.address().port;
      console.log(`Listening on ${port}`);
      h.postJson('http://localhost:' + port + '/json503?',
        {foo: 'bar'});
    });

    let attemptNumber = 0;
    server.post('/json503', (req, res) => {
      const payload = req.body;
      res.status(503);
      res.send(JSON.stringify({
        err: 1
      }));
      res.end();
      assert.deepEqual({foo: 'bar'}, payload);
      attemptNumber++;
      if (attemptNumber < 4) {
        return;
      }

      setTimeout(() => {
        const measurements = r.measurements();
        console.log(`Got ${measurements.length} measurements`);
        let timerCount = 0;
        let finalCount = 0;

        for (let m of measurements) {
          const name = m.id.name;

          if (name !== 'ipc.client.call') {
            assert.fail(m.id.name, 'ipc.client.call', `Unexpected measurement ${m.id.key}`);
          } else {
            ++timerCount;
            assert.equal(m.id.tags.get('http.status'), '503');
            assert.equal(m.id.tags.get('ipc.status'), 'http_error');
            assert.equal(m.id.tags.get('ipc.result'), 'failure');
            assert.equal(m.id.tags.get('ipc.endpoint'), '/json503');
            if (m.id.tags.get('ipc.attempt.final') === 'true') {
              ++finalCount;
            }
          }
        }
        assert.equal(timerCount, 4 * 5);
        assert.equal(finalCount, 5);
        listener.close();
        done();
      }, 10);
    });
  });

  it('handle retries', (done) => {
    const r = new AtlasRegistry();
    const h = new HttpClient(r);
    const server = getServer();

    const listener = server.listen(() => {
      const port = listener.address().port;
      console.log(`Listening on ${port}`);
      h.postJson('http://localhost:' + port + '/json503?',
        {foo: 'bar'});
    });

    let attemptNumber = 0;
    server.post('/json503', (req, res) => {
      const payload = req.body;
      if (attemptNumber === 0) {
        res.status(503);
      } else {
        res.status(200);
      }

      res.send(JSON.stringify({err: attemptNumber === 0}));
      res.end();
      assert.deepEqual({foo: 'bar'}, payload);
      attemptNumber++;
      if (attemptNumber < 2) {
        return;
      }

      setTimeout(() => {
        const measurements = r.measurements();
        console.log(`Got ${measurements.length} measurements`);
        let timerCount = 0;

        for (let m of measurements) {
          const name = m.id.name;

          if (name !== 'ipc.client.call') {
            assert.fail(m.id.name, 'ipc.client.call', `Unexpected measurement ${m.id.key}`);
          } else {
            ++timerCount;
            const isFinal = m.id.tags.get('ipc.attempt.final') === 'true';
            let expectedResult;
            let expectedStatus;
            if (isFinal) {
              expectedStatus = '200';
              expectedResult = 'success';
              assert.equal(m.id.tags.get('ipc.attempt'), 'second');
            } else {
              expectedStatus = '503';
              expectedResult = 'failure';
              assert.equal(m.id.tags.get('ipc.status'), 'http_error');
              assert.equal(m.id.tags.get('ipc.attempt'), 'initial');
            }

            assert.equal(m.id.tags.get('http.status'), expectedStatus);
            assert.equal(m.id.tags.get('ipc.result'), expectedResult);
            assert.equal(m.id.tags.get('ipc.endpoint'), '/json503');
          }
        }
        assert.equal(timerCount, 2 * 5);
        listener.close();
        done();
      }, 10);
    });
  });

  it('handle timeout errors', (done) => {
    const r = new AtlasRegistry({timeout: 10}); // 10ms timeout
    const h = new HttpClient(r);
    const server = getServer();

    const listener = server.listen(() => {
      const port = listener.address().port;
      console.log(`Listening on ${port}`);
      h.postJson('http://localhost:' + port + '/json',
        {foo: 'bar'});
    });

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

          if (name !== 'ipc.client.call') {
            assert.fail(m.id.name, 'ipc.client.call', `Unexpected measurement: ${m.id.key}`);
          } else {
            ++timerCount;
            assert.equal(m.id.tags.get('ipc.endpoint'), '/json');
            assert.equal(m.id.tags.get('ipc.result'), 'failure');
            assert.equal(m.id.tags.get('ipc.status'), 'timeout');
          }
        }
        assert.equal(timerCount, 5);
        listener.close();
        done();
      }, 10);
    }

    server.post('/json', (req, res) => {
      setTimeout(handleRequestLater, 100, req, res);
    });


  });

  it('handle hostname errors', (done) => {
    const r = new AtlasRegistry();
    const h = new HttpClient(r);

    h.postJson('http://foo.example.org/not_found', {foo: 'bar'});
    setTimeout(() => {
      const measurements = r.measurements();
      console.log(`Got ${measurements.length} measurements`);

      for (let m of measurements) {
        if (m.id.name !== 'ipc.client.call') {
          assert.fail(m.id.name, 'ipc.client.call', `Unexpected measurement: ${m.id.key}`);
        } else {
          assert.equal(m.id.tags.get('ipc.result'), 'failure');
          assert.equal(m.id.tags.get('ipc.status'), 'ENOTFOUND');
          assert.equal(m.id.tags.get('ipc.endpoint'), '/not_found');
        }
      }
      done();
    }, 100);
  });
});
