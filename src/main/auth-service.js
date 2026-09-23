'use strict';

const { EventEmitter } = require('node:events');

class AuthService extends EventEmitter {
  constructor({ baseUrl, request = globalThis.fetch, tokenStore }) {
    super();
    if (!baseUrl || typeof request !== 'function' || !tokenStore) throw new TypeError('AuthService requer baseUrl, request e tokenStore');
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
    this.request = request;
    this.tokenStore = tokenStore;
    this.session = null;
  }

  async login(email, password) {
    const response = await this.#json('/v1/auth/login', { method: 'POST', body: { email, password } });
    this.#setSession(response);
    return this.session;
  }

  async refresh() {
    const stored = this.session || await this.tokenStore.load();
    if (!stored?.refreshToken) throw new Error('auth_required');
    const response = await this.#json('/v1/auth/refresh', { method: 'POST', body: { refreshToken: stored.refreshToken } });
    this.#setSession(response);
    return this.session;
  }

  async getLicense() {
    const response = await this.#json('/v1/licenses/current', { method: 'GET', accessToken: await this.#accessToken() });
    this.emit('license', response);
    return response;
  }

  async logout() {
    const token = await this.#accessToken(false);
    if (token) { try { await this.#json('/v1/auth/logout', { method: 'POST', accessToken: token }); } catch {} }
    this.session = null;
    await this.tokenStore.clear();
    this.emit('logout');
  }

  async #accessToken(refreshOnMissing = true) {
    const stored = this.session || await this.tokenStore.load();
    if (stored?.accessToken) { this.session = stored; return stored.accessToken; }
    if (refreshOnMissing && stored?.refreshToken) return (await this.refresh()).accessToken;
    throw new Error('auth_required');
  }

  #setSession(response) {
    if (!response || typeof response.accessToken !== 'string' || typeof response.refreshToken !== 'string') throw new Error('auth_invalid_response');
    this.session = { accessToken: response.accessToken, refreshToken: response.refreshToken, expiresAt: Number(response.expiresAt) || 0 };
    this.tokenStore.save(this.session);
    this.emit('session', { expiresAt: this.session.expiresAt });
  }

  async #json(path, { method, body, accessToken }) {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await this.request(`${this.baseUrl}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data.code || data.message || `http_${response.status}`));
    return data;
  }
}

module.exports = { AuthService };
