'use strict';

const assert = require('node:assert/strict');
const { BOOTSTRAP_SCRIPT, READ_STATE_SCRIPT, OPEN_MARKET_SCRIPT, OPEN_DEPOT_SCRIPT } = require('../src/game/page-scripts');
const { travelScript } = require('../src/game/travel-script');
const { BUY_BALLS_SCRIPT, SELL_ITEMS_SCRIPT, SELL_POKEMON_SCRIPT, SELL_STONE_SCRIPT } = require('../src/game/operation-scripts');

for (const [name, script] of Object.entries({ BOOTSTRAP_SCRIPT, READ_STATE_SCRIPT, OPEN_MARKET_SCRIPT, OPEN_DEPOT_SCRIPT })) {
  assert.doesNotThrow(() => new Function(script), `${name} deve ser JavaScript válido`);
}
assert.doesNotThrow(() => new Function(travelScript('route-1', 'Route 1')), 'travelScript deve ser JavaScript válido');
for (const script of [BUY_BALLS_SCRIPT({ ballId: 1, quantity: 10 }), SELL_ITEMS_SCRIPT([{ itemId: 1, qty: 2 }]), SELL_POKEMON_SCRIPT(['poke-1']), SELL_STONE_SCRIPT({ itemId: 1, quantity: 1 })]) assert.doesNotThrow(() => new Function(script), 'operation script deve ser JavaScript válido');
assert.match(BOOTSTRAP_SCRIPT, /__darkGrid/);
assert.match(READ_STATE_SCRIPT, /collectorVersion/);
console.log('DarkGrid page scripts: contratos injetáveis com sintaxe válida');
