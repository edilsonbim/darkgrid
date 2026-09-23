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
  await service.login('user@example.invalid', 'not-sent-to-game');
  assert.equal((await service.getLicense()).status, 'active');
  await service.refresh();
  assert.equal(store.value.refreshToken, 'refresh-2');
  await service.logout();
  assert.equal(store.value, null);
  assert.equal(calls.some((item) => item.options.headers.Authorization === 'Bearer access-1'), true);
  console.log('DarkGrid auth: login, licença, refresh rotativo e logout OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });
