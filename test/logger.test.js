'use strict';

const chai = require('chai');
const assert = chai.assert;
const getLoggers = require('../src/logger');

describe('Logger', () => {
  it('default to info', () => {
    const log = getLoggers();
    assert.isTrue(log.isLevelEnabled('info'));
    assert.isTrue(log.isLevelEnabled('error'));
    assert.isFalse(log.isLevelEnabled('debug'));
    assert.isFalse(log.isLevelEnabled('trace'));
    assert.isFalse(log.isLevelEnabled('unknown'));

    const l2 = getLoggers('x');
    assert.isTrue(l2.isLevelEnabled('info'));
    assert.isFalse(l2.isLevelEnabled('debug'));
  });

  it('should honor level', () => {
    const log = getLoggers('debug');
    assert.isTrue(log.isLevelEnabled('debug'));
    assert.isFalse(log.isLevelEnabled('trace'));
  });

  it('should write something to stdout', () => {
    const messages = [];
    const f = console.log;
    console.log = (msg) => messages.push(msg);

    const log = getLoggers('warn');
    log.info('Do nothing');
    log.warn('Some warn');
    log.error('Error msg');

    assert.deepEqual(['WARN: Some warn', 'ERROR: Error msg'], messages);
    console.log = f;
  });
});
