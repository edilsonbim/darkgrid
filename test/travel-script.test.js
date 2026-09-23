'use strict';

const assert = require('node:assert/strict');
const vm = require('node:vm');
const { travelScript } = require('../src/game/travel-script');

(async () => {
  const button = { disabled: false, textContent: 'Route 2', title: '', dataset: { guide: 'hunt-route-2' }, classList: { contains: name => name === 'here' }, click() { this.classList.contains = value => value === 'here'; } };
  const context = { window: {}, document: { querySelectorAll: () => [button] }, setTimeout, Date, JSON, Promise, String, Number, Math };
  const result = await vm.runInNewContext(travelScript('route-2', 'Route 2', 1000), context);
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'map');
  assert.match(travelScript('route-3', 'Route 3', 5000), /travel_not_confirmed|travel_not_confirmed/);
  console.log('DarkGrid travel: clique só é sucesso após confirmação observável');
})().catch(error => { console.error(error); process.exitCode = 1; });
