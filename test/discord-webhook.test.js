'use strict';

const assert = require('node:assert/strict');
const { validateWebhookUrl, postDiscordWebhook } = require('../src/main/discord-webhook');

assert.equal(validateWebhookUrl('https://discord.com/api/webhooks/123456789/token_ABC-1'), true);
assert.equal(validateWebhookUrl('https://discordapp.com/api/webhooks/123456789/token'), true);
for (const value of ['http://discord.com/api/webhooks/1/token', 'https://evil.example/api/webhooks/1/token', 'https://discord.com/api/webhooks/1/token?leak=1', 'https://discord.com/']) assert.equal(validateWebhookUrl(value), false);

let requestOptions;
let requestBody = '';
const request = (options, callback) => {
  requestOptions = options;
  const response = { statusCode: 204, resume() {}, on(event, handler) { if (event === 'end') process.nextTick(handler); } };
  process.nextTick(() => callback(response));
  return { setTimeout() {}, on() {}, write(value) { requestBody += value; }, end() {} };
};

postDiscordWebhook('https://discord.com/api/webhooks/123456789/token_ABC-1', 'teste', request).then(() => {
  assert.equal(requestOptions.hostname, 'discord.com');
  assert.equal(requestOptions.path, '/api/webhooks/123456789/token_ABC-1');
  assert.deepEqual(JSON.parse(requestBody), { content: 'teste' });
  console.log('DarkGrid Discord: webhook validado e payload enviado sem rede real');
}).catch((error) => { console.error(error); process.exitCode = 1; });
