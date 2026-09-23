'use strict';

const { EventEmitter } = require('node:events');

class AccountStatePoller extends EventEmitter {
  constructor({ accountId, adapter, intervalMs = 6000, maxFailures = 3, recoveryCooldownMs = 30000, recover = null }) {
    super();
    if (!accountId || !adapter) throw new TypeError('AccountStatePoller requer accountId e adapter');
    this.accountId = String(accountId);
    this.adapter = adapter;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.running = false;
    this.disposed = false;
    this.maxFailures = Math.max(1, Number(maxFailures) || 3);
    this.recoveryCooldownMs = Math.max(1000, Number(recoveryCooldownMs) || 30000);
    this.recover = typeof recover === 'function' ? recover : null;
    this.consecutiveFailures = 0;
    this.lastRecoveryAt = 0;
  }

  start() {
    if (this.disposed || this.timer) return false;
    this.timer = setInterval(() => this.poll(), this.intervalMs);
    this.poll();
    return true;
  }

  async poll() {
    if (this.disposed || this.running) return null;
    this.running = true;
    try {
      const state = await this.adapter.getState();
      this.consecutiveFailures = 0;
      if (!this.disposed) this.emit('state', { accountId: this.accountId, state });
      return state;
    } catch (error) {
      this.consecutiveFailures += 1;
      if (!this.disposed) this.emit('error', { accountId: this.accountId, code: error?.code || 'state_failed', consecutiveFailures: this.consecutiveFailures });
      if (!this.disposed && this.recover && this.consecutiveFailures >= this.maxFailures && Date.now() - this.lastRecoveryAt >= this.recoveryCooldownMs) {
        this.lastRecoveryAt = Date.now();
        this.emit('stalled', { accountId: this.accountId, consecutiveFailures: this.consecutiveFailures });
        try { await this.recover(); } finally { this.consecutiveFailures = 0; }
      }
      return null;
    } finally {
      this.running = false;
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    return true;
  }

  dispose() {
    this.stop();
    this.disposed = true;
    this.removeAllListeners();
  }
}

module.exports = { AccountStatePoller };
