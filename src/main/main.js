'use strict';

const { app, BrowserWindow, ipcMain, safeStorage, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { GAME_ORIGIN, MAX_ACCOUNTS } = require('../shared/constants');

let mainWindow;

function isTrustedUi(event) {
  try { return String(event.senderFrame?.url || '').startsWith('file://'); } catch { return false; }
}

function credentialsPath() { return path.join(app.getPath('userData'), 'credentials.enc'); }

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1050,
    minHeight: 650,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#080b12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try { shell.openExternal(url); } catch {}
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) { event.preventDefault(); try { shell.openExternal(url); } catch {} }
  });
}

ipcMain.handle('app:info', (event) => isTrustedUi(event) ? ({ version: app.getVersion(), platform: process.platform }) : null);

ipcMain.handle('credentials:load', (event) => {
  if (!isTrustedUi(event)) return [];
  try {
    const raw = fs.readFileSync(credentialsPath());
    const json = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.slice(0, MAX_ACCOUNTS) : [];
  } catch { return []; }
});

ipcMain.handle('credentials:save', (event, accounts) => {
  if (!isTrustedUi(event) || !Array.isArray(accounts)) return false;
  try {
    const value = JSON.stringify(accounts.slice(0, MAX_ACCOUNTS));
    if (!safeStorage.isEncryptionAvailable()) return false;
    const target = credentialsPath();
    fs.writeFileSync(`${target}.tmp`, safeStorage.encryptString(value));
    fs.renameSync(`${target}.tmp`, target);
    return true;
  } catch { return false; }
});

app.whenReady().then(() => {
  for (let i = 1; i <= MAX_ACCOUNTS; i++) {
    try { session.fromPartition(`persist:darkgrid-account-${i}`).setPermissionRequestHandler((_wc, _permission, callback) => callback(false)); } catch {}
  }
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
