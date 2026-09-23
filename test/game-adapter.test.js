'use strict';

const assert = require('node:assert/strict');
const { GameAdapter, allowedOrigin } = require('../src/game/game-adapter');

class Surface {
  constructor({ origin = 'https://poke.idleworld.online', execute } = {}) { this.origin = origin; this.executeImpl = execute; this.calls = []; this.running = 0; this.maxRunning = 0; }
  getOrigin() { return this.origin; }
  isDestroyed() { return false; }
  async execute(script) { this.calls.push(script); this.running++; this.maxRunning = Math.max(this.maxRunning, this.running); try { return await this.executeImpl(script); } finally { this.running--; } }
}

assert.equal(allowedOrigin('https://poke.idleworld.online/game', 'https://poke.idleworld.online'), true);
assert.equal(allowedOrigin('https://poke.idleworld.online.evil.test/game', 'https://poke.idleworld.online'), false);

(async () => {
  const surface = new Surface({ execute: async (script) => {
    if (script.includes('collectorVersion')) return { ok: true, status: 'online', huntSlug: 'route-1', level: 42, gold: 500, balls: 20, metrics: { kills: 4, xp: 100, captures: 2, shiny: 1, xph: 900, kph: 36, seconds: 400 } };
    if (script.includes('__darkGrid')) return { ok: true, version: 1 };
    return { ok: true };
  } });
  const adapter = new GameAdapter({ accountId: 'account-a', surface, allowedOrigin: 'https://poke.idleworld.online' });
  const state = await adapter.getState();
  assert.equal(state.accountId, 'account-a');
  assert.equal(state.hunt.slug, 'route-1');
  assert.equal(state.metrics.shiny, 1);
  assert.equal(surface.maxRunning, 1);

  const actionSurface = new Surface({ execute: async () => ({ ok: true }) });
  const actionAdapter = new GameAdapter({ accountId: 'account-b', surface: actionSurface, allowedOrigin: 'https://poke.idleworld.online' });
  await Promise.all([actionAdapter.openDepot(), actionAdapter.openMarket()]);
  assert.equal(actionSurface.maxRunning, 1);

  const blocked = new GameAdapter({ accountId: 'account-c', surface: new Surface({ origin: 'https://evil.test', execute: async () => ({ ok: true }) }), allowedOrigin: 'https://poke.idleworld.online' });
  await assert.rejects(() => blocked.getState(), (cause) => cause.code === 'ORIGIN_NOT_ALLOWED');
  console.log('DarkGrid adapter: bootstrap, snapshot, origem e fila por conta OK');
})().catch((cause) => { console.error(cause); process.exitCode = 1; });
