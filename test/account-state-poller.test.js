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
  console.log('DarkGrid state poller: intervalo, cancelamento e proteção contra concorrência OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
