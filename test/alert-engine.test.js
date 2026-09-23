'use strict';

const assert = require('node:assert/strict');
const { AlertEngine } = require('../src/shared/alert-engine');

const engine = new AlertEngine({ cooldownMs: 1000, noProgressSeconds: 30 });
const base = { accountId: 'account-a', name: 'Ash', status: 'online', hunt: { slug: 'route-1' }, balls: 10, metrics: { kills: 1 } };
assert.deepEqual(engine.process(base, 1000), []);
assert.equal(engine.process({ ...base, balls: 0 }, 2000)[0].type, 'no_balls');
assert.deepEqual(engine.process({ ...base, balls: 0 }, 2500), []);
assert.equal(engine.process({ ...base, status: 'login_required', balls: 0 }, 4000)[0].type, 'account_offline');
assert.equal(engine.processStalled({ accountId: 'account-a', consecutiveFailures: 3 }, 6000)[0].type, 'watchdog');
assert.deepEqual(engine.processStalled({ accountId: 'account-a', consecutiveFailures: 4 }, 6500), []);
console.log('DarkGrid alerts: queda, bolas, cooldown e watchdog OK');
