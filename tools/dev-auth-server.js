'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const { licensePayload } = require('../src/shared/license');

function json(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
  response.end(payload);
}

function createDevAuthServer({ port = 0, email = 'demo@darkgrid.local', password = 'darkgrid-demo' } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  const accessTokens = new Map();
  const refreshTokens = new Map();
  const licenses = new Map();

  function issue(deviceId) {
    const normalizedDevice = String(deviceId || '').slice(0, 128);
    const license = { licenseId: `dev-license-${crypto.randomUUID()}`, userId: 'dev-user', deviceId: normalizedDevice, plan: 'pro', expiresAt: Math.floor(Date.now() / 1000) + 86400, graceUntil: Math.floor(Date.now() / 1000) + 172800 };
    license.signature = crypto.sign(null, Buffer.from(licensePayload(license)), privateKey).toString('base64');
    const accessToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();
    accessTokens.set(accessToken, { deviceId: normalizedDevice, expiresAt: Math.floor(Date.now() / 1000) + 900, licenseId: license.licenseId });
    refreshTokens.set(refreshToken, { deviceId: normalizedDevice, licenseId: license.licenseId });
    licenses.set(license.licenseId, license);
    return { accessToken, refreshToken, expiresAt: Math.floor(Date.now() / 1000) + 900 };
  }

  async function body(request) {
    let raw = '';
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 64 * 1024) throw new Error('body_too_large');
    }
    try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error('invalid_json'); }
  }

  function bearer(request) {
    const value = String(request.headers.authorization || '');
    return value.startsWith('Bearer ') ? value.slice(7) : '';
  }

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      if (request.method === 'POST' && url.pathname === '/v1/auth/login') {
        const input = await body(request);
        if (String(input.email || '').trim().toLowerCase() !== String(email).trim().toLowerCase() || String(input.password || '') !== String(password)) return json(response, 401, { code: 'invalid_credentials' });
        return json(response, 200, issue(input.deviceId));
      }
      if (request.method === 'POST' && url.pathname === '/v1/auth/refresh') {
        const input = await body(request);
        const session = refreshTokens.get(String(input.refreshToken || ''));
        if (!session) return json(response, 401, { code: 'refresh_invalid' });
        refreshTokens.delete(String(input.refreshToken));
        return json(response, 200, issue(session.deviceId));
      }
      if (request.method === 'POST' && url.pathname === '/v1/auth/logout') {
        accessTokens.delete(bearer(request));
        return json(response, 200, { ok: true });
      }
      if (request.method === 'GET' && url.pathname === '/v1/licenses/current') {
        const session = accessTokens.get(bearer(request));
        if (!session || session.expiresAt <= Math.floor(Date.now() / 1000)) return json(response, 401, { code: 'auth_required' });
        const license = licenses.get(session.licenseId);
        return license ? json(response, 200, license) : json(response, 404, { code: 'license_not_found' });
      }
      return json(response, 404, { code: 'not_found' });
    } catch (error) { return json(response, 400, { code: error.message || 'bad_request' }); }
  });

  return { server, publicKey: publicPem, credentials: { email, password }, listen: () => new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server.address()))), close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

if (require.main === module) {
  const auth = createDevAuthServer({ port: Number(process.env.DARKGRID_DEV_AUTH_PORT) || 8787, email: process.env.DARKGRID_DEV_AUTH_EMAIL || undefined, password: process.env.DARKGRID_DEV_AUTH_PASSWORD || undefined });
  auth.listen().then((address) => {
    console.log(`DarkGrid dev auth: http://127.0.0.1:${address.port}`);
    console.log(`DARKGRID_AUTH_URL=http://127.0.0.1:${address.port}`);
    console.log(`DARKGRID_LICENSE_PUBLIC_KEY=${JSON.stringify(auth.publicKey)}`);
    console.log(`DARKGRID_DEV_AUTH_EMAIL=${auth.credentials.email}`);
    console.log(`DARKGRID_DEV_AUTH_PASSWORD=${auth.credentials.password}`);
  });
}

module.exports = { createDevAuthServer };
