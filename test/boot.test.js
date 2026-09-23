'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name, 'darkgrid');
assert.match(fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8'), /DarkGrid/);
assert.match(fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8'), /contextIsolation: true/);
assert.match(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), /auth:dev/);
console.log('DarkGrid boot: estrutura inicial OK');
