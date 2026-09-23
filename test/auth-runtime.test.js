'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { AuthRuntime } = require('../src/main/auth-runtime');
const { licensePayload } = require('../src/shared/license');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
const license = { licenseId: 'lic_1', userId: 'usr_1', deviceId: 'dev_1', plan: 'pro', expiresAt: 4102444800, graceUntil: 4102448400 };
license.signature = crypto.sign(null, Buffer.from(licensePayload(license)), privateKey).toString('base64');

(async () => {
  let cleared = false;
  let cached;
  const runtime = new AuthRuntime({ publicKey: publicPem, licenseStore: { async save(value) { cached = value; }, async load() { return cached; }, async clear() { cached = null; } }, service: {
    async login() { return { accessToken: 'a', refreshToken: 'r', expiresAt: 99 }; },
    async getLicense() { return license; },
    async logout() { cleared = true; }
  } });
  const result = await runtime.login('user@example.test', 'never-persisted');
  assert.equal(result.license.ok, true);
  assert.equal(result.license.plan, 'pro');
const restored = new AuthRuntime({ publicKey: publicPem, licenseStore: { async load() { return cached; } }, service: {} });
  const offline = await restored.getStatus();
  assert.equal(offline.ok, true);
  assert.equal(offline.offline, true);
  assert.equal((await restored.getStatus()).ok, true);
  let revokedCleared = false;
  const revoked = new AuthRuntime({ publicKey: publicPem, licenseStore: { async load() { return cached; }, async clear() { revokedCleared = true; } }, service: { async getLicense() { throw Object.assign(new Error('license_revoked'), { code: 'license_revoked' }); } } });
  assert.equal((await revoked.getStatus()).ok, false);
  assert.equal(revokedCleared, true);
  await runtime.logout();
  assert.equal(cleared, true);
  let invalidated = false;
  const invalidRuntime = new AuthRuntime({ publicKey: publicPem, service: { async login() { return { accessToken: 'a', refreshToken: 'r' }; }, async getLicense() { return { ...license, signature: 'invalid' }; }, async logout() { invalidated = true; } } });
  await assert.rejects(() => invalidRuntime.login('user@example.test', 'password'));
  assert.equal(invalidated, true);
  console.log('DarkGrid auth runtime: login, verificação local de licença e logout OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
