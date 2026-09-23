'use strict';

const crypto = require('node:crypto');

function licensePayload(license) {
  const { signature, ...payload } = license || {};
  return JSON.stringify(payload);
}

function verifyLicense(license, publicKey, now = Date.now()) {
  if (!license || typeof license !== 'object' || typeof license.signature !== 'string') return { ok: false, reason: 'license_malformed' };
  if (!publicKey || typeof publicKey !== 'string') return { ok: false, reason: 'license_public_key_missing' };
  try {
    const valid = crypto.verify(null, Buffer.from(licensePayload(license)), publicKey, Buffer.from(license.signature, 'base64'));
    if (!valid) return { ok: false, reason: 'license_signature_invalid' };
    const seconds = Math.floor(now / 1000);
    if (Number.isFinite(license.expiresAt) && seconds > license.expiresAt) {
      const grace = Number.isFinite(license.graceUntil) && seconds <= license.graceUntil;
      return { ok: grace, offlineGrace: grace, reason: grace ? 'offline_grace' : 'license_expired' };
    }
    return { ok: true, offlineGrace: false, plan: String(license.plan || '') };
  } catch { return { ok: false, reason: 'license_signature_error' }; }
}

module.exports = { licensePayload, verifyLicense };
