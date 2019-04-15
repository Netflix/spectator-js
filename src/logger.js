'use strict';

const levels = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};

function doNothing() {}

function getLoggers(levelLabel) {
  let level = levels[levelLabel || 'info'];
  if (!level) {
    level = levels.info;
  }

  const loggers = {
    isLevelEnabled: (label) => levels[label] >= level
  };

  for (const label of Object.keys(levels)) {
    const l = levels[label];
    if (l < level) {
      loggers[label] = doNothing;
    } else {
      loggers[label] = function() {
        arguments[0] = label.toUpperCase() + ': ' + arguments[0];
        console.log.apply(console, arguments);
      };
    }
  }
  return loggers;
}

module.exports = getLoggers;
