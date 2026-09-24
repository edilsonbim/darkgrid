'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { MAX_OFFLINE_GRACE_SECONDS, licensePayload, verifyLicense } = require('../src/shared/license');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const base = { licenseId: 'lic_test', userId: 'usr_test', deviceId: 'dev_test', plan: 'pro', expiresAt: 2000000000, graceUntil: 2000001000 };
const signature = crypto.sign(null, Buffer.from(licensePayload(base)), privateKey).toString('base64');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });

assert.equal(verifyLicense({ ...base, signature }, publicPem, 1700000000000).ok, true);
assert.equal(verifyLicense({ ...base, signature }, publicPem, 1700000000000, 'other-device').reason, 'license_device_mismatch');
assert.equal(verifyLicense({ ...base, signature }, publicPem, 1700000000000, 'dev_test').ok, true);
assert.equal(verifyLicense({ ...base, signature: `${signature.slice(0, -2)}xx` }, publicPem).ok, false);
assert.equal(verifyLicense({ ...base, signature }, publicPem, 2100000000000).reason, 'license_expired');
const invalidGrace = { ...base, graceUntil: base.expiresAt + MAX_OFFLINE_GRACE_SECONDS + 1 };
const invalidGraceSignature = crypto.sign(null, Buffer.from(licensePayload(invalidGrace)), privateKey).toString('base64');
assert.equal(verifyLicense({ ...invalidGrace, signature: invalidGraceSignature }, publicPem, (base.expiresAt + 1) * 1000).reason, 'license_grace_window_invalid');
console.log('DarkGrid license: assinatura, adulteração e expiração OK');
