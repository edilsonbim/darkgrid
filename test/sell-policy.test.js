'use strict';

const assert = require('node:assert/strict');
const { selectSellableItems, selectSellablePokemon } = require('../src/game/sell-policy');

assert.deepEqual(selectSellableItems([{ id: 1, name: 'Potion', category: 'misc', quantity: 2 }, { id: 2, name: 'Boss Key', category: 'misc', quantity: 3 }, { id: 3, name: 'Stone', category: 'stone', quantity: 4 }]), [{ itemId: 1, qty: 2 }]);
assert.deepEqual(selectSellableItems([{ itemId: 7, qty: 3 }]), [{ itemId: 7, qty: 3 }]);
assert.deepEqual(selectSellablePokemon([{ id: 'safe', sellValue: 10, ivTotal: 50, quality: 1 }, { id: 'team', team: true, sellValue: 10 }, { id: 'shiny', shiny: true, sellValue: 10 }, { id: 'iv', ivTotal: 150, sellValue: 10 }]), ['safe']);
console.log('DarkGrid sell policy: itens e Pokémon protegidos bloqueados por contrato');
