'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');

function trustedUiUrl(rendererPath) { return pathToFileURL(path.resolve(rendererPath)).href; }
function isTrustedUiUrl(url, expectedUrl) { return String(url || '') === String(expectedUrl || ''); }

module.exports = { trustedUiUrl, isTrustedUiUrl };
