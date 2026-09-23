'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
assert.match(source, /state\.auth = await window\.darkGridAPI\.authStatus/);
assert.match(source, /if \(state\.auth\.ok\) await restoreAccounts\(\)/);
assert.doesNotMatch(source, /Promise\.all\(\[window\.darkGridAPI\.authStatus\(\), restoreAccounts\(\)\]\)/);
console.log('DarkGrid renderer: restauração de contas condicionada à licença válida');
