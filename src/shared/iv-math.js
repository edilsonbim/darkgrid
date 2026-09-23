'use strict';

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'speed'];
const EXPONENTS = { hp: 0.95, atk: 0.8, def: 0.8, spa: 0.8, spd: 0.8, speed: 0.95 };

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function projectStat(base, iv, level, quality, key) {
  const values = [base, iv, level, quality].map(finite);
  if (values.some((value) => value == null) || values[2] <= 0 || values[3] <= 0) return null;
  return Math.round((values[0] + 2 * values[1]) * (values[2] / 100) * (values[3] ** EXPONENTS[key]));
}

function inferCandidates(observed, base, level, quality, key) {
  const target = finite(observed);
  if (target == null) return [];
  const candidates = [];
  for (let iv = 1; iv <= 32; iv += 1) if (projectStat(base, iv, level, quality, key) === target) candidates.push(iv);
  return candidates;
}

function possibleSums(groups) {
  let sums = new Set([0]);
  for (const group of groups) {
    const next = new Set();
    for (const sum of sums) for (const value of group) next.add(sum + value);
    sums = next;
  }
  return sums;
}

function constrainByTotal(groups, total) {
  const wanted = finite(total);
  if (wanted == null || !groups.every((group) => group.length)) return groups;
  return groups.map((group, index) => {
    const before = possibleSums(groups.slice(0, index));
    const after = possibleSums(groups.slice(index + 1));
    const allowed = group.filter((value) => [...before].some((left) => [...after].some((right) => left + value + right === Math.round(wanted))));
    return allowed.length ? allowed : group;
  });
}

function scenarioFromTotal(total) {
  const parsed = finite(total);
  if (parsed == null || parsed <= 0) return { values: Object.fromEntries(STAT_KEYS.map((key) => [key, 0])), ranges: Object.fromEntries(STAT_KEYS.map((key) => [key, null])), source: 'unknown', exact: false };
  const wanted = Math.max(6, Math.min(192, Math.round(parsed)));
  const values = Object.fromEntries(STAT_KEYS.map((key) => [key, 1]));
  let remaining = wanted - 6;
  for (let index = 0; remaining > 0; index += 1) {
    const key = STAT_KEYS[index % STAT_KEYS.length];
    if (values[key] < 32) { values[key] += 1; remaining -= 1; }
  }
  const min = Math.max(1, wanted - 5 * 32);
  const max = Math.min(32, wanted - 5);
  return { values, ranges: Object.fromEntries(STAT_KEYS.map((key) => [key, [min, max]])), source: 'total-scenario', exact: false };
}

function normalizeIvs(pokemon = {}) {
  const provided = pokemon.ivs || {};
  if (STAT_KEYS.every((key) => finite(provided[key]) != null)) {
    const values = Object.fromEntries(STAT_KEYS.map((key) => [key, Math.max(0, Math.min(32, finite(provided[key])))]));
    return { values, ranges: Object.fromEntries(STAT_KEYS.map((key) => [key, [values[key], values[key]]])), source: 'individual', exact: true };
  }
  const bases = pokemon.species?.baseStats || pokemon.baseStats || {};
  const observed = pokemon.observedStats || {};
  const level = finite(pokemon.level);
  const quality = finite(pokemon.quality);
  const canInfer = level > 0 && quality > 0 && STAT_KEYS.every((key) => finite(observed[key]) != null && finite(bases[key]) != null);
  if (!canInfer) return scenarioFromTotal(pokemon.ivTotal);
  let groups = STAT_KEYS.map((key) => inferCandidates(observed[key], bases[key], level, quality, key));
  groups = constrainByTotal(groups, pokemon.ivTotal);
  if (!groups.every((group) => group.length)) return scenarioFromTotal(pokemon.ivTotal);
  const values = {};
  const ranges = {};
  groups.forEach((candidates, index) => {
    const key = STAT_KEYS[index];
    ranges[key] = [candidates[0], candidates[candidates.length - 1]];
    values[key] = candidates.length === 1 ? candidates[0] : Math.round((candidates[0] + candidates[candidates.length - 1]) / 2);
  });
  return { values, ranges, source: groups.every((group) => group.length === 1) ? 'observed-exact' : 'observed-range', exact: groups.every((group) => group.length === 1) };
}

function projectPokemon(input = {}, legacyLevel) {
  const pokemon = legacyLevel === undefined && (input.species || input.observedStats || input.ivs) ? input : { ...input, species: { baseStats: input.baseStats || {} }, level: legacyLevel === undefined ? input.level : legacyLevel };
  const bases = pokemon.species?.baseStats || pokemon.baseStats || {};
  const iv = normalizeIvs(pokemon);
  const quality = Math.max(0.01, finite(pokemon.quality) || 1);
  const stats = Object.fromEntries(STAT_KEYS.map((key) => [key, projectStat(bases[key], iv.values[key], pokemon.level, quality, key)]));
  const valid = STAT_KEYS.every((key) => stats[key] != null);
  return { stats, power: valid ? Math.round(STAT_KEYS.reduce((sum, key) => sum + stats[key], 0) * quality) : null, valid, ivSource: iv.source, ivs: iv.values, ivRanges: iv.ranges, ivExact: iv.exact };
}

module.exports = { STAT_KEYS, EXPONENTS, projectStat, inferCandidates, normalizeIvs, projectPokemon };
