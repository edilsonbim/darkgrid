'use strict';

const { projectPokemon } = require('./iv-math');
const { typeEffectiveness } = require('./type-chart');

function key(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\[.*?\]|\(.*?\)/g, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function baseStats(value) { const input = value?.baseStats || value || {}; return { hp: Number(input.hp || input.baseHp), atk: Number(input.atk || input.baseAtk), def: Number(input.def || input.baseDef), spa: Number(input.spa || input.baseSpAtk || input.baseSpa), spd: Number(input.spd || input.baseSpDef), speed: Number(input.speed || input.baseSpeed || input.vel) }; }
function attacks(value) { return (value?.attacks || value?.moves || []).map((move) => ({ name: String(move?.name || move?.[0] || 'Golpe'), power: Number(move?.power ?? move?.[1]) || 0, type: String(move?.type ?? move?.[2] ?? '').toUpperCase(), category: String(move?.category ?? move?.[3] ?? '').toUpperCase(), learnLevel: Number(move?.learnLevel ?? move?.[5]) || 0 })).filter((move) => move.power > 0 && move.type); }

function calculateTierList(catalog, requestedLevel = 0) {
  const creatures = Array.isArray(catalog?.creatures) ? catalog.creatures.slice(0, 2000) : [];
  const hunts = Array.isArray(catalog?.hunts) ? catalog.hunts.slice(0, 500) : [];
  const byName = new Map(creatures.map((creature) => [key(creature.name), creature]));
  const rows = [];
  const level = Math.max(0, Math.min(600, Number(requestedLevel) || 0));
  for (const creature of creatures) {
    const name = String(creature.name || '').slice(0, 100);
    const attackerBase = baseStats(creature);
    const attackerMoves = attacks(creature);
    if (!name || !attackerMoves.length || !Object.values(attackerBase).every((value) => value > 0)) continue;
    let best = null;
    let general = 0;
    for (const hunt of hunts) {
      const huntLevel = Math.max(1, Number(hunt.level) || 1);
      if (level > 0 && huntLevel > level) continue;
      const defender = hunt.baseStats || byName.get(key(hunt.species || hunt.name));
      const defenderBase = baseStats(defender);
      if (!defender || !Object.values(defenderBase).every((value) => value > 0)) continue;
      const attackerLevel = level || huntLevel;
      const attacker = projectPokemon({ baseStats: attackerBase, level: attackerLevel, quality: 1, ivTotal: 96 });
      const target = projectPokemon({ baseStats: defenderBase, level: huntLevel, quality: 1, ivTotal: 96 });
      if (!attacker.valid || !target.valid) continue;
      let bestMove = null;
      for (const move of attackerMoves) {
        if (move.learnLevel > attackerLevel) continue;
        const effectiveness = typeEffectiveness(move.type, [hunt.t1 || defender.type1, hunt.t2 || defender.type2]);
        if (effectiveness <= 0) continue;
        const offense = move.category === 'PHYSICAL' || move.category === 'P' ? attacker.stats.atk : attacker.stats.spa;
        const defense = Math.max(1, move.category === 'PHYSICAL' || move.category === 'P' ? target.stats.def : target.stats.spd);
        const damage = 0.2 * move.power * effectiveness * (offense / defense);
        const ratio = Math.min(damage / Math.max(1, target.stats.hp), 1);
        if (!bestMove || ratio > bestMove.ratio || (ratio === bestMove.ratio && effectiveness > bestMove.effectiveness)) bestMove = { name: move.name, ratio, effectiveness, margin: damage / Math.max(1, target.stats.hp), physical: move.category === 'PHYSICAL' || move.category === 'P' };
      }
      if (!bestMove) continue;
      const score = bestMove.ratio * Math.max(0, Number(hunt.xp) || 0);
      general += score;
      if (!best || score > best.score || (score === best.score && bestMove.margin > best.move.margin)) best = { score, move: bestMove, hunt: { slug: String(hunt.slug || '').slice(0, 100), name: String(hunt.name || hunt.slug || '').slice(0, 100), level: huntLevel } };
    }
    if (best && best.score > 0) rows.push({ name, types: [creature.type1, creature.type2].filter(Boolean).map((type) => String(type).toLowerCase()), score: best.score, composite: best.score * (1 + 0.1 * Math.min(best.move.margin, 4) / 4), general, move: best.move, hunt: best.hunt });
  }
  const unique = new Map();
  for (const row of rows) { const words = row.name.split(' '); const candidate = words.length > 1 && rows.some((other) => key(other.name) === key(words.slice(1).join(' '))) ? words.slice(1).join(' ') : row.name; if (!unique.has(key(candidate)) || row.composite > unique.get(key(candidate)).composite) unique.set(key(candidate), { ...row, baseName: candidate }); }
  return [...unique.values()].sort((left, right) => (right.composite - left.composite) || (right.general - left.general)).slice(0, 500);
}

module.exports = { calculateTierList };
