'use strict';

const assert = require('node:assert/strict');
const { AuthService } = require('../src/main/auth-service');
const { AuthRuntime } = require('../src/main/auth-runtime');
const { createDevAuthServer } = require('../tools/dev-auth-server');

class Store {
  value = null;
  async load() { return this.value; }
  async save(value) { this.value = value; }
  async clear() { this.value = null; }
}

(async () => {
  const dev = createDevAuthServer({ email: 'qa@darkgrid.local', password: 'qa-password' });
  const address = await dev.listen();
  const store = new Store();
  const service = new AuthService({ baseUrl: `http://127.0.0.1:${address.port}`, allowInsecureLocalhost: true, tokenStore: store });
  const runtime = new AuthRuntime({ service, publicKey: dev.publicKey, deviceId: 'qa-device-1' });
  const result = await runtime.login('qa@darkgrid.local', 'qa-password');
  assert.equal(result.ok, true);
  assert.equal(result.license.ok, true);
  assert.equal(result.license.plan, 'pro');
  const firstAccess = store.value.accessToken;
  await service.refresh();
  assert.notEqual(store.value.accessToken, firstAccess);
  await assert.rejects(() => new AuthService({ baseUrl: `http://127.0.0.1:${address.port}`, allowInsecureLocalhost: true, tokenStore: new Store() }).login('qa@darkgrid.local', 'wrong'), /invalid_credentials/);
  await runtime.logout();
  await dev.close();
  console.log('DarkGrid dev auth: login HTTP, assinatura Ed25519, device binding e refresh OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });
