'use strict';

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'speed'];
const EXPONENTS = { hp: 0.95, atk: 0.8, def: 0.8, spa: 0.8, spd: 0.8, speed: 0.95 };

function projectStat(base, iv, level, quality, key) {
  const values = [base, iv, level, quality].map(Number);
  if (!values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) return null;
  return Math.round((values[0] + 2 * values[1]) * (values[2] / 100) * (values[3] ** EXPONENTS[key]));
}

function scenarioFromTotal(total) {
  const wanted = Math.max(6, Math.min(192, Math.round(Number(total) || 96)));
  const values = Object.fromEntries(STAT_KEYS.map((key) => [key, 1]));
  let remaining = wanted - STAT_KEYS.length;
  for (let index = 0; remaining > 0; index += 1) {
    const key = STAT_KEYS[index % STAT_KEYS.length];
    if (values[key] < 32) { values[key] += 1; remaining -= 1; }
  }
  return values;
}

function projectPokemon({ baseStats = {}, level, quality = 1, ivTotal = 96 }) {
  const ivs = scenarioFromTotal(ivTotal);
  const stats = Object.fromEntries(STAT_KEYS.map((key) => [key, projectStat(baseStats[key], ivs[key], level, quality, key)]));
  return { stats, ivs, valid: STAT_KEYS.every((key) => stats[key] != null) };
}

module.exports = { STAT_KEYS, projectStat, projectPokemon };
