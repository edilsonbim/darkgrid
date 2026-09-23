'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('darkGridAPI', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  loadCredentials: () => ipcRenderer.invoke('credentials:load'),
  saveCredentials: (accounts) => ipcRenderer.invoke('credentials:save', accounts),
  loadProfiles: () => ipcRenderer.invoke('profiles:load'),
  saveProfiles: (profiles) => ipcRenderer.invoke('profiles:save', profiles),
  loadHuntHistory: () => ipcRenderer.invoke('history:load'),
  exportHuntHistory: () => ipcRenderer.invoke('history:export'),
  loadAlertConfig: () => ipcRenderer.invoke('alerts:load'),
  saveAlertConfig: (config) => ipcRenderer.invoke('alerts:save', config),
  addAccount: (account) => ipcRenderer.invoke('account:add', account),
  openAccount: (id) => ipcRenderer.invoke('account:open', id),
  closeAccount: (id) => ipcRenderer.invoke('account:close', id),
  removeAccount: (id) => ipcRenderer.invoke('account:remove', id),
  setAccountLayout: (layout) => ipcRenderer.invoke('account:layout', layout),
  setLayoutMode: (mode) => ipcRenderer.invoke('account:layout-mode', mode),
  setAccountsVisible: (visible) => ipcRenderer.invoke('account:visibility', visible),
  getAccountState: (id) => ipcRenderer.invoke('account:state', id),
  accountAction: (id, action, input) => ipcRenderer.invoke('account:action', id, action, input),
  authStatus: () => ipcRenderer.invoke('auth:status'),
  authLogin: (email, password) => ipcRenderer.invoke('auth:login', email, password),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  calculateTierlist: (catalog, level) => ipcRenderer.invoke('analytics:tierlist', catalog, level),
  onAccountState: (callback) => ipcRenderer.on('account:state-updated', (_event, payload) => callback(payload)),
  onAccountStatus: (callback) => ipcRenderer.on('account:status', (_event, payload) => callback(payload)),
  onAccountCreated: (callback) => ipcRenderer.on('account:created', (_event, payload) => callback(payload)),
  onAccountRemoved: (callback) => ipcRenderer.on('account:removed', (_event, payload) => callback(payload)),
  onHistoryUpdated: (callback) => ipcRenderer.on('history:updated', (_event, payload) => callback(payload)),
  onAccountAlert: (callback) => ipcRenderer.on('account:alert', (_event, payload) => callback(payload))
});
