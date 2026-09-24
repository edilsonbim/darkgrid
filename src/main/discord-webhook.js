'use strict';

const https = require('node:https');

function validateWebhookUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:') return false;
    if (url.hostname !== 'discord.com' && url.hostname !== 'discordapp.com') return false;
    if (!/^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+$/.test(url.pathname)) return false;
    return url.search === '' && url.hash === '';
  } catch {
    return false;
  }
}

function postDiscordWebhook(webhookUrl, content, request = https.request) {
  if (!validateWebhookUrl(webhookUrl)) return Promise.reject(new Error('invalid_discord_webhook'));
  const url = new URL(webhookUrl);
  const body = JSON.stringify({ content: String(content || '').slice(0, 1900) });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; if (error) reject(error); else resolve(value); };
    const req = request({ hostname: url.hostname, port: 443, path: url.pathname, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, (response) => {
      response.resume();
      response.on('end', () => response.statusCode >= 200 && response.statusCode < 300 ? finish(null, true) : finish(new Error(`discord_http_${response.statusCode}`)));
    });
    req.setTimeout(5000, () => req.destroy(new Error('discord_timeout')));
    req.on('error', (error) => finish(error));
    req.write(body);
    req.end();
  });
}

module.exports = { validateWebhookUrl, postDiscordWebhook };
