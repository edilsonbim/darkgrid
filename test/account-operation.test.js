'use strict';

const assert = require('node:assert/strict');
const vm = require('node:vm');
const { GameAdapter } = require('../src/game/game-adapter');
const { BUY_BALLS_SCRIPT } = require('../src/game/operation-scripts');

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
  let scriptCalls = 0;
  const scriptPartial = await vm.runInNewContext(BUY_BALLS_SCRIPT({ ballId: 1, quantity: 10 }), {
    fetch: async () => { scriptCalls += 1; return { status: 400, ok: false, json: async () => ({ requiresTown: true, bought: 4 }) }; }
  });
  assert.equal(scriptPartial.operationStatus, 'partial');
  assert.equal(scriptPartial.ok, false);
  assert.equal(scriptPartial.bought, 4);
  assert.equal(scriptPartial.retryAllowed, false);
  assert.equal(scriptCalls, 1, 'script de compra não deve repetir uma resposta parcial do servidor');

  const surface = new Surface();
  const adapter = new GameAdapter({ accountId: 'account-a', surface, allowedOrigin: 'https://poke.idleworld.online' });
  await adapter.getState();
  const result = await adapter.buyBalls({ ballId: 1, quantity: 10 });
  assert.equal(result.ok, true);
  assert.equal(result.town.ok, true);
  assert.equal(result.returned.returnedToHunt, 'route-1');
  assert.equal(result.operationStatus, 'completed');
  assert.equal(result.returnStatus, 'confirmed');
  assert.equal(surface.buyAttempts, 2);

  class PartialSurface extends Surface {
    async execute(script) {
      this.calls.push(script);
      if (script.includes('collectorVersion')) return { ok: true, status: 'online', huntSlug: 'route-1' };
      if (script.includes('/api/game/shop/buy')) { this.buyAttempts += 1; return { ok: false, requiresTown: true, reason: 'city_required', requested: 10, bought: 4, remaining: 6, operationStatus: 'partial', operationOk: false, retryAllowed: false }; }
      return { ok: true };
    }
  }
  const partialSurface = new PartialSurface();
  const partialAdapter = new GameAdapter({ accountId: 'account-partial', surface: partialSurface, allowedOrigin: 'https://poke.idleworld.online' });
  await partialAdapter.getState();
  const partial = await partialAdapter.buyBalls({ ballId: 1, quantity: 10 });
  assert.equal(partial.ok, false);
  assert.equal(partial.operationStatus, 'partial');
  assert.equal(partial.operationOk, false);
  assert.equal(partial.retrySuppressed, true);
  assert.equal(partial.bought, 4);
  assert.equal(partialSurface.buyAttempts, 1, 'compra parcialmente confirmada não pode ser repetida após requiresTown');
  assert.equal(partialSurface.calls.some((script) => script.includes('dock-home')), false);

  class ReturnFailureSurface extends Surface {
    async execute(script) {
      this.calls.push(script);
      if (script.includes('collectorVersion')) return { ok: true, status: 'online', huntSlug: 'route-1' };
      if (script.includes('/api/game/shop/buy')) { this.buyAttempts += 1; return this.buyAttempts === 1 ? { ok: false, requiresTown: true, reason: 'city_required', retryAllowed: true, operationStatus: 'failed' } : { ok: true, operationStatus: 'completed', operationOk: true, requested: 10, bought: 10 }; }
      if (script.includes('returnedToHunt')) return { ok: false, reason: 'return_not_confirmed', operationStatus: 'failed' };
      return { ok: true };
    }
  }
  const returnFailureSurface = new ReturnFailureSurface();
  const returnFailureAdapter = new GameAdapter({ accountId: 'account-return-failure', surface: returnFailureSurface, allowedOrigin: 'https://poke.idleworld.online' });
  await returnFailureAdapter.getState();
  const returnFailure = await returnFailureAdapter.buyBalls({ ballId: 1, quantity: 10 });
  assert.equal(returnFailure.ok, false);
  assert.equal(returnFailure.operationStatus, 'completed');
  assert.equal(returnFailure.operationOk, true, 'a compra confirmada continua distinguível da falha de retorno');
  assert.equal(returnFailure.returnStatus, 'failed');
  assert.equal(returnFailure.returnReason, 'return_not_confirmed');
  assert.equal(returnFailure.returned.ok, false);

  console.log('DarkGrid operation coordinator: compra parcial, retry único e retorno confirmado/falho OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
