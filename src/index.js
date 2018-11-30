'use strict';

const AtlasRegistry = require('./registry');

function newRegistry(config) {
  return new AtlasRegistry(config);
}

module.exports = {
  newRegistry: newRegistry
};
