'use strict';

const ACCOUNT_STATUS = Object.freeze({
  UNCONFIGURED: 'unconfigured',
  LOGIN_REQUIRED: 'login_required',
  AUTHENTICATING: 'authenticating',
  CAPTCHA: 'captcha',
  ONLINE: 'online',
  HUNTING: 'hunting',
  PAUSED: 'paused',
  OFFLINE: 'offline',
  RECOVERING: 'recovering',
  ACTION: 'action',
  ERROR: 'error',
  DISABLED: 'disabled'
});

function createAccountState(id, slot) {
  return { id, slot, label: `Conta ${slot + 1}`, enabled: false, status: ACCOUNT_STATUS.UNCONFIGURED, metrics: {}, lastUpdatedAt: 0, error: null };
}

module.exports = { ACCOUNT_STATUS, createAccountState };
