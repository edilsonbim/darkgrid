'use strict';

const assert = require('node:assert/strict');
const { BOOTSTRAP_SCRIPT, READ_STATE_SCRIPT, OPEN_MARKET_SCRIPT, OPEN_DEPOT_SCRIPT, TRAVEL_SCRIPT } = require('../src/game/page-scripts');

for (const [name, script] of Object.entries({ BOOTSTRAP_SCRIPT, READ_STATE_SCRIPT, OPEN_MARKET_SCRIPT, OPEN_DEPOT_SCRIPT })) {
  assert.doesNotThrow(() => new Function(script), `${name} deve ser JavaScript válido`);
}
assert.doesNotThrow(() => new Function(TRAVEL_SCRIPT('route-1', 'Route 1')), 'TRAVEL_SCRIPT deve ser JavaScript válido');
assert.match(BOOTSTRAP_SCRIPT, /__darkGrid/);
assert.match(READ_STATE_SCRIPT, /collectorVersion/);
console.log('DarkGrid page scripts: contratos injetáveis com sintaxe válida');
