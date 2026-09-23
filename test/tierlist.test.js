'use strict';

const assert = require('node:assert/strict');
const { calculateTierList } = require('../src/shared/tierlist');

const stats = (value) => ({ hp: value, atk: value, def: value, spa: value, spd: value, speed: value });
const catalog = {
  creatures: [
    { name: 'Flameling', type1: 'Fire', baseStats: stats(80), attacks: [{ name: 'Brasa', power: 90, type: 'Fire', category: 'SPECIAL' }] },
    { name: 'Leafling', type1: 'Grass', baseStats: stats(80), attacks: [{ name: 'Folha', power: 90, type: 'Grass', category: 'SPECIAL' }] },
    { name: 'Rockbeast', type1: 'Rock', baseStats: stats(80), attacks: [{ name: 'Pedra', power: 70, type: 'Rock', category: 'PHYSICAL' }] }
  ],
  hunts: [
    { slug: 'water-lake', name: 'Water Lake', level: 10, t1: 'Water', xp: 100, species: 'Water Lake', baseStats: stats(400) },
    { slug: 'rock-cave', name: 'Rock Cave', level: 10, t1: 'Rock', xp: 100, species: 'Rock Cave', baseStats: stats(400) }
  ]
};

const rows = calculateTierList(catalog, 20);
assert.ok(rows.length >= 2);
assert.equal(rows[0].name, 'Leafling');
assert.equal(rows[0].hunt.slug, 'water-lake');
assert.ok(rows[0].score > 0);
assert.deepEqual(calculateTierList({ creatures: [], hunts: [] }), []);
console.log('DarkGrid tierlist: cálculo modular, ordenação e dados insuficientes OK');
