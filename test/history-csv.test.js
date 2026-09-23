'use strict';

const assert = require('node:assert/strict');
const { historyToCsv } = require('../src/shared/history-csv');

const output = historyToCsv([{ finishedAt: Date.UTC(2026, 0, 2), accountName: 'Conta; 1', huntName: 'Rota "A"', kills: 4, xp: 80, captures: 1, shiny: 0, durationSeconds: 120 }]);
assert.match(output, /"Data";"Conta";"Hunt"/);
assert.match(output, /"Conta; 1";"Rota ""A"""/);
assert.match(output, /"4";"80";"1";"0";"120"/);
console.log('DarkGrid history CSV: escape e colunas estáveis OK');
