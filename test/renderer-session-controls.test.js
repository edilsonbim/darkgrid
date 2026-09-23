'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
assert.match(html, /id="logoutButton"/);
assert.match(html, /id="operationsModal"/);
assert.match(html, /id="buyBallsForm"/);
assert.match(html, /id="performanceValue"/);
assert.match(app, /authLogout\(\)/);
assert.match(app, /removeAccount\(account\.id\)/);
assert.match(app, /accountAction\(account\.id, action/);
console.log('DarkGrid renderer: logout encerra painéis sem apagar perfis locais');
