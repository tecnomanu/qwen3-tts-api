'use strict';
const { EngineManager } = require('../../engine/EngineManager');

module.exports = async function restart(ctx) {
  await new EngineManager(ctx).restart();
};
