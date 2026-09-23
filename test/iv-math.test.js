'use strict';

const assert = require('node:assert/strict');
const { STAT_KEYS, projectPokemon, normalizeIvs } = require('../src/shared/iv-math');

const gyarados = { level: 138, quality: 1.53, ivTotal: 177, ivs: { hp: 31, atk: 30, def: 28, spa: 27, spd: 30, speed: 31 }, species: { baseStats: { hp: 95, atk: 125, def: 79, spa: 60, spd: 100, speed: 81 } } };
const current = projectPokemon(gyarados);
assert.deepEqual(STAT_KEYS.map((key) => current.stats[key]), [325, 359, 262, 221, 310, 296]);
assert.equal(current.power, 2713);
const inferred = normalizeIvs({ ...gyarados, ivs: {}, observedStats: current.stats });
assert.equal(inferred.source, 'observed-exact');
assert.deepEqual(inferred.values, gyarados.ivs);
const totalOnly = normalizeIvs({ ivTotal: 177, level: 138, quality: 1.53, species: gyarados.species });
assert.equal(totalOnly.source, 'total-scenario');
assert.deepEqual(totalOnly.ranges.hp, [17, 32]);
console.log('DarkGrid IV math: projeção, inferência e cenário por total OK');
