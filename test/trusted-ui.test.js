'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { trustedUiUrl, isTrustedUiUrl } = require('../src/main/trusted-ui');

const expected = trustedUiUrl(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
assert.equal(isTrustedUiUrl(expected, expected), true);
assert.equal(isTrustedUiUrl('file:///C:/other.html', expected), false);
assert.equal(isTrustedUiUrl(`${expected}#injected`, expected), false);
console.log('DarkGrid security: IPC restrito ao renderer oficial');
