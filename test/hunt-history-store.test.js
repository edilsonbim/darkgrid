'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { HuntHistoryStore } = require('../src/main/hunt-history-store');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-history-'));
const filePath = path.join(directory, 'history.json');
try {
  const store = new HuntHistoryStore({ filePath, maxEntries: 2 });
assert.equal(store.record({ accountId: 'a', name: 'Ash', hunt: { slug: 'route-1', name: 'Route 1' }, metrics: { kills: 12, xp: 300, captures: 2, shiny: 1, seconds: 60, gph: 500, balance: 1000 } }), null);
const entry = store.record({ accountId: 'a', name: 'Ash', hunt: { slug: 'route-2', name: 'Route 2' }, metrics: { kills: 1, xp: 10 } });
assert.equal(entry.huntSlug, 'route-1');
assert.equal(entry.gph, 500);
assert.equal(entry.balance, 1000);
  assert.equal(entry.kills, 12);
  assert.equal(store.getAll().length, 1);
  const restored = new HuntHistoryStore({ filePath, maxEntries: 2 });
  assert.equal(restored.getAll()[0].huntName, 'Route 1');
  assert.equal(restored.record({ accountId: 'b', hunt: { slug: 'route-x' }, metrics: { kills: 0 } }), null);
  console.log('DarkGrid hunt history: troca de hunt, limite e persistência OK');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
