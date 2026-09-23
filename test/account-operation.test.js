'use strict';

const assert = require('node:assert/strict');
const { GameAdapter } = require('../src/game/game-adapter');

class Surface {
  constructor() { this.calls = []; this.buyAttempts = 0; }
  getOrigin() { return 'https://poke.idleworld.online'; }
  isDestroyed() { return false; }
  async execute(script) {
    this.calls.push(script);
    if (script.includes('collectorVersion')) return { ok: true, status: 'online', huntSlug: 'route-1', level: 10, gold: 100, balls: 5 };
    if (script.includes('returnedToHunt')) return { ok: true, returnedToHunt: 'route-1' };
    if (script.includes('__darkGrid')) return { ok: true, version: 1 };
    if (script.includes('/api/game/shop/buy')) { this.buyAttempts += 1; return this.buyAttempts === 1 ? { ok: false, requiresTown: true, reason: 'city_required' } : { ok: true, bought: 10 }; }
    if (script.includes('dock-home')) return { ok: true };
    return { ok: true };
  }
}

(async () => {
  const surface = new Surface();
  const adapter = new GameAdapter({ accountId: 'account-a', surface, allowedOrigin: 'https://poke.idleworld.online' });
  await adapter.getState();
  const result = await adapter.buyBalls({ ballId: 1, quantity: 10 });
  assert.equal(result.ok, true);
  assert.equal(result.town.ok, true);
  assert.equal(result.returned.returnedToHunt, 'route-1');
  assert.equal(surface.buyAttempts, 2);
  console.log('DarkGrid operation coordinator: cidade, retry único e retorno confirmado OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
