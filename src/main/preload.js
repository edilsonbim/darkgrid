'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('darkGridAPI', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  loadCredentials: () => ipcRenderer.invoke('credentials:load'),
  saveCredentials: (accounts) => ipcRenderer.invoke('credentials:save', accounts)
});
