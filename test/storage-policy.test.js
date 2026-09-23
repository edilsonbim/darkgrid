'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'main.js'), 'utf8');
assert.match(source, /if \(!safeStorage\.isEncryptionAvailable\(\)\) return \[\];/);
assert.match(source, /safeStorage\.decryptString\(raw\)/);
assert.doesNotMatch(source, /safeStorage\.isEncryptionAvailable\(\) \? safeStorage\.decryptString\(raw\) : raw\.toString/);
console.log('DarkGrid storage: credenciais nunca são aceitas em texto puro');
