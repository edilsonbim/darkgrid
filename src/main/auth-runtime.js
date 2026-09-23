'use strict';

const { EventEmitter } = require('node:events');
const { verifyLicense } = require('../shared/license');

class AuthRuntime extends EventEmitter {
  constructor({ service, publicKey, licenseStore }) {
    super();
    if (!service) throw new TypeError('AuthRuntime requer service');
    this.service = service;
    this.publicKey = publicKey || '';
    this.licenseStore = licenseStore || null;
    this.license = null;
  }

  async login(email, password) {
    const session = await this.service.login(String(email || '').trim(), String(password || ''));
    try {
      const license = await this.refreshLicense();
      return { ok: true, expiresAt: session.expiresAt, license };
    } catch (cause) {
      try { await this.service.logout(); } catch {}
      throw cause;
    }
  }

  async refreshLicense() {
    const raw = await this.service.getLicense();
    const license = raw?.license && typeof raw.license === 'object' ? raw.license : raw;
    const result = verifyLicense(license, this.publicKey);
    if (!result.ok) {
      this.license = { ok: false, reason: result.reason };
      this.emit('license', this.license);
      const error = new Error(result.reason);
      error.code = result.reason;
      throw error;
    }
    this.license = { ...result, licenseId: license.licenseId, plan: license.plan };
    await this.licenseStore?.save(license);
    this.emit('license', this.license);
    return this.license;
  }

  async logout() {
    await this.service.logout();
    this.license = null;
    await this.licenseStore?.clear();
    return { ok: true };
  }

  async getStatus() {
    if (this.license) return this.license;
    const cached = await this.licenseStore?.load();
    if (!cached) return { ok: false, reason: 'auth_required' };
    const result = verifyLicense(cached, this.publicKey);
    if (!result.ok) return { ok: false, reason: result.reason };
    this.license = { ...result, licenseId: cached.licenseId, plan: cached.plan };
    return this.license;
  }
}

module.exports = { AuthRuntime };
