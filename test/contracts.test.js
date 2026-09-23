'use strict';

const assert = require('node:assert/strict');
const { ACCOUNT_STATUS, createAccountState } = require('../src/shared/account-state');
const { GameSurface } = require('../src/game/game-surface');
const { GameClient } = require('../src/game/game-client');

const state = createAccountState('account-a', 0);
assert.equal(state.status, ACCOUNT_STATUS.UNCONFIGURED);
assert.equal(state.slot, 0);
assert.equal(new GameClient(new GameSurface('surface-a', 'persist:darkgrid-account-a')).surface.id, 'surface-a');
console.log('DarkGrid contracts: estado de conta e GameSurface OK');
