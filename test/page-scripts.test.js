'use strict';

const assert = require('node:assert/strict');
const { BOOTSTRAP_SCRIPT, READ_STATE_SCRIPT, OPEN_MARKET_SCRIPT, OPEN_DEPOT_SCRIPT } = require('../src/game/page-scripts');
const { travelScript } = require('../src/game/travel-script');
const { returnHuntScript } = require('../src/game/return-hunt-script');
const { GO_TOWN_SCRIPT } = require('../src/game/town-script');
const { DETECT_GAME_LOGIN_SCRIPT, FILL_GAME_LOGIN_SCRIPT, SUBMIT_GAME_LOGIN_SCRIPT } = require('../src/game/game-login-script');
const { READ_DEPOT_SCRIPT } = require('../src/game/depot-script');
const { READ_POKEMON_SCRIPT } = require('../src/game/pokemon-script');
const { BUY_BALLS_SCRIPT, SELL_ITEMS_SCRIPT, SELL_POKEMON_SCRIPT, SELL_STONE_SCRIPT } = require('../src/game/operation-scripts');

for (const [name, script] of Object.entries({ BOOTSTRAP_SCRIPT, READ_STATE_SCRIPT, OPEN_MARKET_SCRIPT, OPEN_DEPOT_SCRIPT })) {
  assert.doesNotThrow(() => new Function(script), `${name} deve ser JavaScript válido`);
}
assert.doesNotThrow(() => new Function(travelScript('route-1', 'Route 1')), 'travelScript deve ser JavaScript válido');
assert.doesNotThrow(() => new Function(returnHuntScript({ slug: 'route-1', name: 'Route 1' })), 'returnHuntScript deve ser JavaScript válido');
assert.doesNotThrow(() => new Function(GO_TOWN_SCRIPT), 'GO_TOWN_SCRIPT deve ser JavaScript válido');
for (const script of [DETECT_GAME_LOGIN_SCRIPT, FILL_GAME_LOGIN_SCRIPT({ username: 'user', password: 'secret' }), SUBMIT_GAME_LOGIN_SCRIPT]) assert.doesNotThrow(() => new Function(script), 'game login script deve ser JavaScript válido');
assert.doesNotThrow(() => new Function(READ_DEPOT_SCRIPT), 'depot script deve ser JavaScript válido');
assert.doesNotThrow(() => new Function(READ_POKEMON_SCRIPT), 'pokemon script deve ser JavaScript válido');
for (const script of [BUY_BALLS_SCRIPT({ ballId: 1, quantity: 10 }), SELL_ITEMS_SCRIPT([{ itemId: 1, qty: 2 }]), SELL_POKEMON_SCRIPT(['poke-1']), SELL_STONE_SCRIPT({ itemId: 1, quantity: 1 })]) assert.doesNotThrow(() => new Function(script), 'operation script deve ser JavaScript válido');
assert.match(BOOTSTRAP_SCRIPT, /__darkGrid/);
assert.match(READ_STATE_SCRIPT, /collectorVersion/);
console.log('DarkGrid page scripts: contratos injetáveis com sintaxe válida');
