'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { licensePayload, verifyLicense } = require('../src/shared/license');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const base = { licenseId: 'lic_test', userId: 'usr_test', deviceId: 'dev_test', plan: 'pro', expiresAt: 2000000000, graceUntil: 2000001000 };
const signature = crypto.sign(null, Buffer.from(licensePayload(base)), privateKey).toString('base64');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });

assert.equal(verifyLicense({ ...base, signature }, publicPem, 1700000000000).ok, true);
assert.equal(verifyLicense({ ...base, signature: `${signature.slice(0, -2)}xx` }, publicPem).ok, false);
assert.equal(verifyLicense({ ...base, signature }, publicPem, 2100000000000).reason, 'license_expired');
console.log('DarkGrid license: assinatura, adulteração e expiração OK');
