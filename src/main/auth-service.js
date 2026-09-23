'use strict';

const { EventEmitter } = require('node:events');

class AuthService extends EventEmitter {
  constructor({ baseUrl, request = globalThis.fetch, tokenStore, requestTimeoutMs = 15000, allowInsecureLocalhost = false }) {
    super();
    if (!baseUrl || typeof request !== 'function' || !tokenStore) throw new TypeError('AuthService requer baseUrl, request e tokenStore');
    let parsed;
    try { parsed = new URL(String(baseUrl)); } catch { throw Object.assign(new Error('auth_url_invalid'), { code: 'auth_url_invalid' }); }
    const localInsecure = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(allowInsecureLocalhost && localInsecure)) throw Object.assign(new Error('auth_url_https_required'), { code: 'auth_url_https_required' });
    this.baseUrl = parsed.toString().replace(/\/$/, '');
    this.request = request;
    this.tokenStore = tokenStore;
    this.requestTimeoutMs = Math.max(1000, Number(requestTimeoutMs) || 15000);
    this.session = null;
  }

  async login(email, password, deviceId = '') {
    const body = { email, password };
    if (deviceId) body.deviceId = String(deviceId).slice(0, 128);
    const response = await this.#json('/v1/auth/login', { method: 'POST', body });
    await this.#setSession(response);
    return this.session;
  }

  async refresh() {
    const stored = this.session || await this.tokenStore.load();
    if (!stored?.refreshToken) throw new Error('auth_required');
    const response = await this.#json('/v1/auth/refresh', { method: 'POST', body: { refreshToken: stored.refreshToken } });
    await this.#setSession(response);
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
    const expiresAt = Number(stored?.expiresAt) || 0;
    if (stored?.accessToken && (!refreshOnMissing || !expiresAt || expiresAt > Math.floor(Date.now() / 1000) + 30)) { this.session = stored; return stored.accessToken; }
    if (refreshOnMissing && stored?.refreshToken) return (await this.refresh()).accessToken;
    throw new Error('auth_required');
  }

  async #setSession(response) {
    if (!response || typeof response.accessToken !== 'string' || typeof response.refreshToken !== 'string') throw new Error('auth_invalid_response');
    this.session = { accessToken: response.accessToken, refreshToken: response.refreshToken, expiresAt: Number(response.expiresAt) || 0 };
    await this.tokenStore.save(this.session);
    this.emit('session', { expiresAt: this.session.expiresAt });
  }

  async #json(path, { method, body, accessToken }) {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.requestTimeoutMs) : null;
    let response;
    try {
      response = await this.request(`${this.baseUrl}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), ...(controller ? { signal: controller.signal } : {}) });
    } catch (cause) {
      if (controller?.signal.aborted) { const timeout = new Error('auth_request_timeout'); timeout.code = 'auth_request_timeout'; throw timeout; }
      throw cause;
    } finally { if (timer) clearTimeout(timer); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data.code || data.message || `http_${response.status}`));
    return data;
  }
}

module.exports = { AuthService };
