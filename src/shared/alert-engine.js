'use strict';

const DEFAULT_ALERT_CONFIG = Object.freeze({
  enabled: true,
  accountOffline: true,
  noBalls: true,
  noProgress: true,
  nativeNotifications: true,
  discordNotifications: false,
  lowBalls: 0,
  noProgressSeconds: 600,
  cooldownMs: 60000
});

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAlertConfig(value = {}) {
  return {
    enabled: value.enabled !== false,
    accountOffline: value.accountOffline !== false,
    noBalls: value.noBalls !== false,
    noProgress: value.noProgress !== false,
    nativeNotifications: value.nativeNotifications !== false,
    discordNotifications: value.discordNotifications === true,
    lowBalls: Math.max(0, Math.floor(number(value.lowBalls, DEFAULT_ALERT_CONFIG.lowBalls))),
    noProgressSeconds: Math.max(30, Math.floor(number(value.noProgressSeconds, DEFAULT_ALERT_CONFIG.noProgressSeconds))),
    cooldownMs: Math.max(1000, Math.floor(number(value.cooldownMs, DEFAULT_ALERT_CONFIG.cooldownMs)))
  };
}

class AlertEngine {
  constructor(config = {}) {
    this.config = normalizeAlertConfig(config);
    this.accounts = new Map();
    this.lastAlertAt = new Map();
  }

  getConfig() { return { ...this.config }; }

  configure(config) {
    this.config = normalizeAlertConfig(config);
    return this.getConfig();
  }

  process(snapshot, now = Date.now()) {
    const accountId = String(snapshot?.accountId || '');
    if (!accountId) return [];
    const previous = this.accounts.get(accountId);
    const current = {
      name: String(snapshot?.name || accountId).slice(0, 80),
      status: String(snapshot?.status || ''),
      huntSlug: String(snapshot?.hunt?.slug || ''),
      kills: Math.max(0, number(snapshot?.metrics?.kills, 0)),
      balls: Math.max(0, number(snapshot?.balls, 0)),
      lastProgressAt: previous?.lastProgressAt || now
    };
    const alerts = [];
    if (previous && this.config.enabled && this.config.accountOffline && this.#wasConnected(previous.status) && !this.#wasConnected(current.status)) {
      const alert = this.#emit(accountId, 'account_offline', `A conta ${current.name} perdeu a conexão.`, now);
      if (alert) alerts.push(alert);
    }
    if (previous && (current.kills > previous.kills || current.huntSlug !== previous.huntSlug)) current.lastProgressAt = now;
    if (this.config.enabled && this.config.noBalls && this.#wasConnected(current.status) && current.balls <= this.config.lowBalls) {
      const alert = this.#emit(accountId, 'no_balls', `A conta ${current.name} está sem Pokébolas.`, now);
      if (alert) alerts.push(alert);
    }
    if (this.config.enabled && this.config.noProgress && this.#wasConnected(current.status) && now - current.lastProgressAt >= this.config.noProgressSeconds * 1000) {
      const alert = this.#emit(accountId, 'no_progress', `A conta ${current.name} está sem progresso recente.`, now);
      if (alert) alerts.push(alert);
    }
    this.accounts.set(accountId, current);
    return alerts;
  }

  processStalled({ accountId, consecutiveFailures = 0 } = {}, now = Date.now()) {
    if (!this.config.enabled || !accountId) return [];
    const name = this.accounts.get(String(accountId))?.name || String(accountId);
    const alert = this.#emit(String(accountId), 'watchdog', `A conta ${name} está travada; tentando recuperar.`, now, { consecutiveFailures });
    return alert ? [alert] : [];
  }

  #wasConnected(status) { return status === 'online' || status === 'stale'; }

  #emit(accountId, type, message, now, extra = {}) {
    const key = `${accountId}:${type}`;
    const last = this.lastAlertAt.get(key) || 0;
    if (now - last < this.config.cooldownMs) return null;
    this.lastAlertAt.set(key, now);
    return { accountId, type, message, severity: type === 'account_offline' || type === 'watchdog' ? 'warning' : 'info', createdAt: now, ...extra };
  }
}

module.exports = { AlertEngine, DEFAULT_ALERT_CONFIG, normalizeAlertConfig };
