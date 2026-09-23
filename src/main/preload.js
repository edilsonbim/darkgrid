'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('darkGridAPI', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  loadCredentials: () => ipcRenderer.invoke('credentials:load'),
  saveCredentials: (accounts) => ipcRenderer.invoke('credentials:save', accounts),
  loadProfiles: () => ipcRenderer.invoke('profiles:load'),
  saveProfiles: (profiles) => ipcRenderer.invoke('profiles:save', profiles),
  addAccount: (account) => ipcRenderer.invoke('account:add', account),
  openAccount: (id) => ipcRenderer.invoke('account:open', id),
  closeAccount: (id) => ipcRenderer.invoke('account:close', id),
  removeAccount: (id) => ipcRenderer.invoke('account:remove', id),
  setAccountLayout: (layout) => ipcRenderer.invoke('account:layout', layout),
  onAccountStatus: (callback) => ipcRenderer.on('account:status', (_event, payload) => callback(payload)),
  onAccountCreated: (callback) => ipcRenderer.on('account:created', (_event, payload) => callback(payload)),
  onAccountRemoved: (callback) => ipcRenderer.on('account:removed', (_event, payload) => callback(payload))
});
