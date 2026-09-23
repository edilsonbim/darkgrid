'use strict';

const assert = require('node:assert/strict');
const { AccountStatePoller } = require('../src/main/account-state-poller');

(async () => {
  let calls = 0;
  let release;
  const adapter = { getState: async () => { calls += 1; if (release) await release; return { status: 'online' }; } };
  const poller = new AccountStatePoller({ accountId: 'account-a', adapter, intervalMs: 5 });
  const states = [];
  poller.on('state', payload => states.push(payload));
  const stateReceived = new Promise(resolve => poller.once('state', resolve));
  release = new Promise(resolve => { setTimeout(resolve, 20); });
  poller.start();
  await stateReceived;
  poller.dispose();
  assert.equal(calls, 1, 'poller não deve sobrepor leituras');
  assert.equal(states.length, 1);
  assert.equal(states[0].accountId, 'account-a');
  let recoveries = 0;
  const stalledPoller = new AccountStatePoller({ accountId: 'account-b', adapter: { async getState() { throw Object.assign(new Error('timeout'), { code: 'SURFACE_TIMEOUT' }); } }, maxFailures: 2, recoveryCooldownMs: 1000, recover: async () => { recoveries += 1; } });
  stalledPoller.on('error', () => {});
  await stalledPoller.poll();
  await stalledPoller.poll();
  stalledPoller.dispose();
  assert.equal(recoveries, 1, 'watchdog deve recuperar uma vez após falhas consecutivas');
  console.log('DarkGrid state poller: intervalo, cancelamento e proteção contra concorrência OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
