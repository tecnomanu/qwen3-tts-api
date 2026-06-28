'use strict';
const { EngineManager } = require('../../engine/EngineManager');

module.exports = async function stop(ctx) {
  await new EngineManager(ctx).stop();
};
