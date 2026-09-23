'use strict';

const { EventEmitter } = require('node:events');

class AccountStatePoller extends EventEmitter {
  constructor({ accountId, adapter, intervalMs = 6000 }) {
    super();
    if (!accountId || !adapter) throw new TypeError('AccountStatePoller requer accountId e adapter');
    this.accountId = String(accountId);
    this.adapter = adapter;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.running = false;
    this.disposed = false;
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
      if (!this.disposed) this.emit('state', { accountId: this.accountId, state });
      return state;
    } catch (error) {
      if (!this.disposed) this.emit('error', { accountId: this.accountId, code: error?.code || 'state_failed' });
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
