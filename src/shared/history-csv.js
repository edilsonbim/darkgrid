'use strict';

function csv(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function historyToCsv(entries = []) {
  const header = ['Data', 'Conta', 'Hunt', 'Kills', 'XP', 'Capturas', 'Shinies', 'Duração (s)', 'Gold/h', 'Saldo', 'Loot gold', 'Capturas gold', 'Suprimentos gold', 'Pokébolas usadas', 'Poções usadas'];
  const rows = Array.isArray(entries) ? entries.map((entry) => [
    new Date(Number(entry?.finishedAt) || 0).toISOString(),
    entry?.accountName || entry?.accountId || '',
    entry?.huntName || entry?.huntSlug || '',
    Number(entry?.kills) || 0,
    Number(entry?.xp) || 0,
    Number(entry?.captures) || 0,
    Number(entry?.shiny) || 0,
    Number(entry?.durationSeconds) || 0,
    Number(entry?.gph) || 0,
    Number(entry?.balance) || 0,
    Number(entry?.lootGold) || 0,
    Number(entry?.capturesGold) || 0,
    Number(entry?.supplyGold) || 0,
    Number(entry?.ballsUsed) || 0,
    Number(entry?.potionsUsed) || 0
  ]) : [];
  return [header, ...rows].map((row) => row.map(csv).join(';')).join('\r\n') + '\r\n';
}

module.exports = { historyToCsv };
