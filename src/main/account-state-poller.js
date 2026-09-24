'use strict';

const { EventEmitter } = require('node:events');

class AccountStatePoller extends EventEmitter {
  constructor({ accountId, adapter, intervalMs = 6000, maxFailures = 3, recoveryCooldownMs = 30000, recover = null, shouldRecover = null }) {
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
    this.shouldRecover = typeof shouldRecover === 'function' ? shouldRecover : null;
    this.consecutiveFailures = 0;
    this.lastRecoveryAt = 0;
    this.lastState = null;
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
      this.lastState = state;
      if (!this.disposed) this.emit('state', { accountId: this.accountId, state });
      return state;
    } catch (error) {
      this.consecutiveFailures += 1;
      if (!this.disposed) this.emit('error', { accountId: this.accountId, code: error?.code || 'state_failed', consecutiveFailures: this.consecutiveFailures });
      let eligible = Boolean(this.recover && this.shouldRecover && this.consecutiveFailures >= this.maxFailures && Date.now() - this.lastRecoveryAt >= this.recoveryCooldownMs && this.lastState?.status !== 'login_required');
      if (eligible) {
        try { eligible = Boolean(await this.shouldRecover(error, { accountId: this.accountId, consecutiveFailures: this.consecutiveFailures, lastState: this.lastState })); } catch { eligible = false; }
      }
      if (!this.disposed && eligible) {
        this.lastRecoveryAt = Date.now();
        this.emit('stalled', { accountId: this.accountId, consecutiveFailures: this.consecutiveFailures });
        this.emit('recovery', { accountId: this.accountId, status: 'recovering', consecutiveFailures: this.consecutiveFailures });
        try {
          await this.recover();
          this.emit('recovery', { accountId: this.accountId, status: 'online', consecutiveFailures: this.consecutiveFailures });
        } catch (recoveryError) {
          this.emit('recovery', { accountId: this.accountId, status: 'error', code: recoveryError?.code || 'recovery_failed', consecutiveFailures: this.consecutiveFailures });
        } finally { this.consecutiveFailures = 0; }
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
