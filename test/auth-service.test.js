'use strict';

const assert = require('node:assert/strict');
const { AuthService } = require('../src/main/auth-service');

class Store {
  value = null;
  async load() { return this.value; }
  async save(value) { this.value = value; }
  async clear() { this.value = null; }
}
function response(body, ok = true, status = 200) { return { ok, status, async json() { return body; } }; }

(async () => {
  const calls = [];
  const store = new Store();
  const service = new AuthService({ baseUrl: 'https://api.darkgrid.invalid', tokenStore: store, request: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/login')) return response({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 123 });
    if (url.endsWith('/licenses/current')) return response({ status: 'active', plan: 'pro' });
    if (url.endsWith('/refresh')) return response({ accessToken: 'access-2', refreshToken: 'refresh-2', expiresAt: 456 });
    if (url.endsWith('/logout')) return response({ ok: true });
    return response({}, false, 404);
  } });
  await service.login('user@example.invalid', 'not-sent-to-game', 'device-test-1');
  assert.equal(JSON.parse(calls[0].options.body).deviceId, 'device-test-1');
  assert.equal((await service.getLicense()).status, 'active');
  await service.refresh();
  assert.equal(store.value.refreshToken, 'refresh-2');
  await service.logout();
  assert.equal(store.value, null);
  assert.equal(calls.some((item) => /^Bearer access-[12]$/.test(item.options.headers.Authorization || '')), true);
  const expiredStore = new Store();
  expiredStore.value = { accessToken: 'expired', refreshToken: 'refresh-old', expiresAt: Math.floor(Date.now() / 1000) - 60 };
  const refreshed = new AuthService({ baseUrl: 'https://api.darkgrid.invalid', tokenStore: expiredStore, request: async (url) => response(url.endsWith('/refresh') ? { accessToken: 'fresh', refreshToken: 'refresh-new', expiresAt: 9999999999 } : { status: 'active' }) });
  assert.equal((await refreshed.getLicense()).status, 'active');
  assert.equal(expiredStore.value.accessToken, 'fresh');
  const timeoutService = new AuthService({ baseUrl: 'https://api.darkgrid.invalid', requestTimeoutMs: 1000, tokenStore: store, request: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) });
  await assert.rejects(() => timeoutService.login('user@example.invalid', 'password'), error => error.code === 'auth_request_timeout');
  assert.throws(() => new AuthService({ baseUrl: 'http://api.darkgrid.invalid', tokenStore: store, request: async () => response({}) }), error => error.code === 'auth_url_https_required');
  assert.doesNotThrow(() => new AuthService({ baseUrl: 'http://localhost:3010', allowInsecureLocalhost: true, tokenStore: store, request: async () => response({}) }));
  console.log('DarkGrid auth: login, licença, refresh rotativo e logout OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });
