'use strict';

const { EventEmitter } = require('node:events');
const { BOOTSTRAP_SCRIPT, READ_STATE_SCRIPT, OPEN_MARKET_SCRIPT, OPEN_DEPOT_SCRIPT } = require('./page-scripts');
const { travelScript } = require('./travel-script');
const { BUY_BALLS_SCRIPT, SELL_ITEMS_SCRIPT, SELL_POKEMON_SCRIPT, SELL_STONE_SCRIPT } = require('./operation-scripts');
const { selectSellableItems, selectSellablePokemon } = require('./sell-policy');

const VALID_STATUSES = new Set(['online', 'stale', 'login_required']);

function error(code, message, cause) { const result = new Error(message); result.code = code; if (cause) result.cause = cause; return result; }
function allowedOrigin(url, expected) { try { return new URL(url).origin === new URL(expected).origin; } catch { return false; } }

class SerialQueue {
  tail = Promise.resolve();
  run(task) { const next = this.tail.then(task, task); this.tail = next.catch(() => {}); return next; }
}

class GameAdapter extends EventEmitter {
  constructor({ accountId, surface, allowedOrigin, executionTimeoutMs = 10000 }) {
    super();
    if (!accountId || !surface || !allowedOrigin) throw new TypeError('GameAdapter requer accountId, surface e allowedOrigin');
    this.accountId = String(accountId); this.surface = surface; this.allowedOrigin = allowedOrigin; this.executionTimeoutMs = executionTimeoutMs; this.queue = new SerialQueue(); this.bootstrapped = false;
  }

  bootstrap() { return this.#run(() => this.#execute(BOOTSTRAP_SCRIPT)).then((result) => { if (!result?.ok) throw error('BOOTSTRAP_FAILED', 'Coletor do jogo não foi inicializado'); this.bootstrapped = true; return result; }); }
  getState() { return this.#run(async () => { if (!this.bootstrapped) await this.#execute(BOOTSTRAP_SCRIPT); const raw = await this.#execute(READ_STATE_SCRIPT); return this.#normalizeState(raw); }); }
  openMarket() { return this.#action(OPEN_MARKET_SCRIPT); }
  openDepot() { return this.#action(OPEN_DEPOT_SCRIPT); }
  travelToHunt({ slug, name }) { return this.#action(travelScript(slug, name)); }
  buyBalls(input) { return this.#action(BUY_BALLS_SCRIPT(input || {})); }
  sellItems(input) { const items = Array.isArray(input) ? input : input?.items; const protectedIds = Array.isArray(input?.protectedIds) ? input.protectedIds : []; return this.#action(SELL_ITEMS_SCRIPT(selectSellableItems(items, protectedIds))); }
  sellPokemon(pokemon) { return this.#action(SELL_POKEMON_SCRIPT(selectSellablePokemon(pokemon))); }
  sellStone(input) { return this.#action(SELL_STONE_SCRIPT(input || {})); }

  #action(script) { return this.#run(async () => { const result = await this.#execute(script); if (!result || typeof result !== 'object' || typeof result.ok !== 'boolean') throw error('INVALID_ACTION_RESULT', 'O jogo devolveu um resultado de ação inválido'); return { ...result, accountId: this.accountId }; }); }
  #run(task) { return this.queue.run(async () => { try { return await task(); } catch (cause) { if (cause?.code) throw cause; throw error('SURFACE_EXECUTION_FAILED', cause?.message || 'Falha ao executar ação no painel', cause); } }); }
  async #execute(script) {
    if (typeof this.surface.isDestroyed === 'function' && this.surface.isDestroyed()) throw error('SURFACE_DESTROYED', 'O painel da conta foi destruído');
    const origin = typeof this.surface.getOrigin === 'function' ? this.surface.getOrigin() : this.surface.origin;
    if (!allowedOrigin(origin, this.allowedOrigin)) throw error('ORIGIN_NOT_ALLOWED', 'A superfície não está na origem oficial');
    let timer;
    try {
      return await Promise.race([Promise.resolve(this.surface.execute(script)), new Promise((_, reject) => { timer = setTimeout(() => reject(error('SURFACE_TIMEOUT', 'O painel não respondeu dentro do prazo')), this.executionTimeoutMs); })]);
    } catch (cause) { if (cause?.code) throw cause; throw error('SURFACE_EXECUTION_FAILED', cause?.message || 'Falha no painel', cause); }
    finally { if (timer) clearTimeout(timer); }
  }
  #normalizeState(raw) {
    if (!raw || typeof raw !== 'object' || raw.ok !== true || !VALID_STATUSES.has(raw.status)) throw error('INVALID_GAME_STATE', 'Estado do jogo inválido ou incompatível');
    const n = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    return { accountId: this.accountId, status: raw.status, hunt: raw.huntSlug ? { slug: String(raw.huntSlug), name: String(raw.huntSlug).replace(/[_-]+/g, ' ') } : null, level: n(raw.level), gold: n(raw.gold), balls: Math.max(0, n(raw.balls)), metrics: raw.metrics && typeof raw.metrics === 'object' ? { kills: Math.max(0, n(raw.metrics.kills)), xp: Math.max(0, n(raw.metrics.xp)), captures: Math.max(0, n(raw.metrics.captures)), shiny: Math.max(0, n(raw.metrics.shiny)), xph: Math.max(0, n(raw.metrics.xph)), kph: Math.max(0, n(raw.metrics.kph)), seconds: Math.max(0, n(raw.metrics.seconds)) } : {}, updatedAt: Date.now() };
  }
}

module.exports = { GameAdapter, SerialQueue, allowedOrigin };
