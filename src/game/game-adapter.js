'use strict';

const { EventEmitter } = require('node:events');
const { BOOTSTRAP_SCRIPT, READ_STATE_SCRIPT, OPEN_MARKET_SCRIPT, OPEN_DEPOT_SCRIPT } = require('./page-scripts');
const { travelScript } = require('./travel-script');
const { returnHuntScript } = require('./return-hunt-script');
const { GO_TOWN_SCRIPT } = require('./town-script');
const { DETECT_GAME_LOGIN_SCRIPT, FILL_GAME_LOGIN_SCRIPT, SUBMIT_GAME_LOGIN_SCRIPT } = require('./game-login-script');
const { BUY_BALLS_SCRIPT, SELL_ITEMS_SCRIPT, SELL_POKEMON_SCRIPT, SELL_STONE_SCRIPT } = require('./operation-scripts');
const { selectSellableItems, selectSellablePokemon } = require('./sell-policy');
const { READ_DEPOT_SCRIPT } = require('./depot-script');
const { READ_POKEMON_SCRIPT } = require('./pokemon-script');
const { READ_HUNTS_SCRIPT } = require('./hunt-script');
const { userScript } = require('./user-script');

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
    this.accountId = String(accountId); this.surface = surface; this.allowedOrigin = allowedOrigin; this.executionTimeoutMs = executionTimeoutMs; this.queue = new SerialQueue(); this.bootstrapped = false; this.lastHunt = null; this.huntCatalogCache = null; this.huntCatalogCachedAt = 0;
  }

  bootstrap() { return this.#run(() => this.#execute(BOOTSTRAP_SCRIPT)).then((result) => { if (!result?.ok) throw error('BOOTSTRAP_FAILED', 'Coletor do jogo não foi inicializado'); this.bootstrapped = true; return result; }); }
  getState() { return this.#run(async () => { if (!this.bootstrapped) await this.#execute(BOOTSTRAP_SCRIPT); const raw = await this.#execute(READ_STATE_SCRIPT); return this.#normalizeState(raw); }); }
  openMarket() { return this.#action(OPEN_MARKET_SCRIPT); }
  openDepot() { return this.#action(OPEN_DEPOT_SCRIPT); }
  readDepot() { return this.#action(READ_DEPOT_SCRIPT); }
  readPokemon() { return this.#action(READ_POKEMON_SCRIPT); }
  async readHunts({ force = false } = {}) { if (!force && this.huntCatalogCache && Date.now() - this.huntCatalogCachedAt < 60000) return this.huntCatalogCache; const result = await this.#action(READ_HUNTS_SCRIPT); if (result?.ok && Array.isArray(result.hunts)) { this.huntCatalogCache = result; this.huntCatalogCachedAt = Date.now(); } return result; }
  travelToHunt({ slug, name }) { return this.#action(travelScript(slug, name)); }
  returnToLastHunt(input) { return this.#action(returnHuntScript(input || {})); }
  detectGameLogin() { return this.#action(DETECT_GAME_LOGIN_SCRIPT); }
  fillGameCredentials(input) { return this.#action(FILL_GAME_LOGIN_SCRIPT(input || {})); }
  submitGameLogin() { return this.#action(SUBMIT_GAME_LOGIN_SCRIPT); }
  runUserScript(input) { return this.#action(userScript(input?.script)); }
  reload() { return this.#run(async () => { if (typeof this.surface.reload !== 'function') throw error('RELOAD_UNAVAILABLE', 'A superfície não suporta reload'); this.bootstrapped = false; await this.surface.reload(); return { ok: true, accountId: this.accountId }; }); }
  async recover() {
    const hunt = this.lastHunt ? { ...this.lastHunt } : null;
    await this.reload();
    let ready = false;
    for (let attempt = 0; attempt < 12 && !ready; attempt += 1) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 350));
      try { ready = Boolean((await this.bootstrap())?.ok); } catch {}
    }
    if (!ready) throw error('RECOVERY_BOOTSTRAP_FAILED', 'O painel não ficou pronto após o reload');
    if (!hunt?.slug) return { ok: true, accountId: this.accountId, resumed: false };
    const resumed = await this.returnToLastHunt(hunt);
    return { ...resumed, accountId: this.accountId, resumed: Boolean(resumed?.ok) };
  }
  buyBalls(input) { return this.#actionWithTown(BUY_BALLS_SCRIPT(input || {})); }
  sellItems(input) { const items = Array.isArray(input) ? input : input?.items; const protectedIds = Array.isArray(input?.protectedIds) ? input.protectedIds : []; return this.#actionWithTown(SELL_ITEMS_SCRIPT(selectSellableItems(items, protectedIds))); }
  previewSellItems(input) { const items = Array.isArray(input) ? input : input?.items; const protectedIds = Array.isArray(input?.protectedIds) ? input.protectedIds : []; return { ok: true, items: selectSellableItems(items, protectedIds), accountId: this.accountId }; }
  previewSellPokemon(input) { const pokemon = Array.isArray(input) ? input : input?.pokemon; return { ok: true, pokeIds: selectSellablePokemon(pokemon), accountId: this.accountId }; }
  sellPokemon(pokemon) { const list = Array.isArray(pokemon) ? pokemon : pokemon?.pokemon; return this.#actionWithTown(SELL_POKEMON_SCRIPT(selectSellablePokemon(list))); }
  sellStone(input) { return this.#actionWithTown(SELL_STONE_SCRIPT(input || {})); }

  #action(script) { return this.#run(async () => ({ ...this.#validateActionResult(await this.#execute(script)), accountId: this.accountId })); }
  #actionWithTown(script) { return this.#run(async () => { const first = this.#validateActionResult(await this.#execute(script)); if (!first.requiresTown) return { ...first, accountId: this.accountId }; const town = this.#validateActionResult(await this.#execute(GO_TOWN_SCRIPT)); if (!town.ok) return { ...first, ok: false, reason: town.reason || 'town_not_confirmed', town, accountId: this.accountId }; const retry = this.#validateActionResult(await this.#execute(script)); if (!retry.ok) return { ...retry, town, accountId: this.accountId }; let returned = { ok: true, skipped: true }; if (this.lastHunt?.slug) returned = this.#validateActionResult(await this.#execute(returnHuntScript(this.lastHunt))); return { ...retry, ok: returned.ok, town, returned, accountId: this.accountId }; }); }
  #validateActionResult(result) { if (!result || typeof result !== 'object' || typeof result.ok !== 'boolean') throw error('INVALID_ACTION_RESULT', 'O jogo devolveu um resultado de ação inválido'); return result; }
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
    const hunt = raw.huntSlug ? { slug: String(raw.huntSlug), name: String(raw.huntSlug).replace(/[_-]+/g, ' ') } : null;
    if (hunt) this.lastHunt = hunt;
    const inventory = Array.isArray(raw.inventory) ? raw.inventory.slice(0, 200).map((item) => ({ itemId: String(item?.itemId || '').slice(0, 32), name: String(item?.name || '').slice(0, 80), category: String(item?.category || '').slice(0, 40), quantity: Math.max(0, n(item?.quantity)) })).filter((item) => item.itemId && item.quantity > 0) : [];
    const team = Array.isArray(raw.team) ? raw.team.slice(0, 6).map((pokemon) => ({ id: String(pokemon?.id || '').slice(0, 64), name: String(pokemon?.name || 'Pokémon').slice(0, 60), level: Math.max(0, n(pokemon?.level)), hp: Math.max(0, n(pokemon?.hp)), maxHp: Math.max(0, n(pokemon?.maxHp)), ivTotal: Math.max(0, n(pokemon?.ivTotal)), quality: Math.max(0, n(pokemon?.quality)), shiny: Boolean(pokemon?.shiny), leader: Boolean(pokemon?.leader), starter: Boolean(pokemon?.starter), locked: Boolean(pokemon?.locked) })).filter((pokemon) => pokemon.id) : [];
    const metrics = raw.metrics && typeof raw.metrics === 'object' ? { kills: Math.max(0, n(raw.metrics.kills)), xp: Math.max(0, n(raw.metrics.xp)), captures: Math.max(0, n(raw.metrics.captures)), shiny: Math.max(0, n(raw.metrics.shiny)), xph: Math.max(0, n(raw.metrics.xph)), kph: Math.max(0, n(raw.metrics.kph)), gph: n(raw.metrics.gph), balance: n(raw.metrics.balance), lootGold: Math.max(0, n(raw.metrics.lootGold)), capturesGold: Math.max(0, n(raw.metrics.capturesGold)), supplyGold: Math.max(0, n(raw.metrics.supplyGold)), ballsUsed: Math.max(0, n(raw.metrics.ballsUsed)), potionsUsed: Math.max(0, n(raw.metrics.potionsUsed)), seconds: Math.max(0, n(raw.metrics.seconds)), serverBacked: Boolean(raw.metrics.serverBacked) } : {};
    const analyzer = raw.analyzer && typeof raw.analyzer === 'object' ? { serverBacked: Boolean(raw.analyzer.serverBacked), seconds: Math.max(0, n(raw.analyzer.seconds)), kills: Math.max(0, n(raw.analyzer.kills)), captures: Math.max(0, n(raw.analyzer.captures)), shinyCaptures: Math.max(0, n(raw.analyzer.shinyCaptures)), xpGained: Math.max(0, n(raw.analyzer.xpGained)), lootGold: Math.max(0, n(raw.analyzer.lootGold)), capturesGold: Math.max(0, n(raw.analyzer.capturesGold)), supplyGold: Math.max(0, n(raw.analyzer.supplyGold)), ballsUsed: Math.max(0, n(raw.analyzer.ballsUsed)), potionsUsed: Math.max(0, n(raw.analyzer.potionsUsed)), balance: n(raw.analyzer.balance), drops: Array.isArray(raw.analyzer.drops) ? raw.analyzer.drops.slice(0, 60).map((item) => ({ name: String(item?.name || '').slice(0, 80), qty: Math.max(0, n(item?.qty)), gold: Math.max(0, n(item?.gold)) })).filter((item) => item.name) : [] } : null;
    return { accountId: this.accountId, status: raw.status, hunt, level: n(raw.level), gold: n(raw.gold), balls: Math.max(0, n(raw.balls)), inventory, team, analyzer, metrics, drops: Array.isArray(raw.drops) ? raw.drops.slice(0, 100) : [], updatedAt: Date.now() };
  }
}

module.exports = { GameAdapter, SerialQueue, allowedOrigin };
