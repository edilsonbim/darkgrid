'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const main = fs.readFileSync(path.join(__dirname, '..', 'src/main/main.js'), 'utf8');
assert.match(main, /profiles:load/);
assert.match(main, /profiles:save/);
assert.match(main, /normalizeProfiles/);
console.log('DarkGrid profiles: persistência e normalização presentes');
