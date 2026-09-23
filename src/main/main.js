'use strict';

const { app, BrowserWindow, WebContentsView, ipcMain, safeStorage, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { GAME_ORIGIN, MAX_ACCOUNTS } = require('../shared/constants');
const { GameViewManager } = require('./game-view-manager');
const { GameAdapter } = require('../game/game-adapter');
const { AccountStatePoller } = require('./account-state-poller');
const { AuthService } = require('./auth-service');
const { AuthRuntime } = require('./auth-runtime');

let mainWindow;
let gameViews;
const gameAdapters = new Map();
const accountPollers = new Map();
let authRuntime;

function isTrustedUi(event) {
  try { return String(event.senderFrame?.url || '').startsWith('file://'); } catch { return false; }
}

function credentialsPath() { return path.join(app.getPath('userData'), 'credentials.enc'); }
function profilesPath() { return path.join(app.getPath('userData'), 'account-profiles.json'); }
function authSessionPath() { return path.join(app.getPath('userData'), 'auth-session.enc'); }
function licenseCachePath() { return path.join(app.getPath('userData'), 'license-cache.enc'); }

const tokenStore = {
  async load() {
    try {
      const raw = fs.readFileSync(authSessionPath());
      return JSON.parse(safeStorage.decryptString(raw));
    } catch { return null; }
  },
  async save(value) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('secure_storage_unavailable');
    const target = authSessionPath();
    fs.writeFileSync(`${target}.tmp`, safeStorage.encryptString(JSON.stringify(value)));
    fs.renameSync(`${target}.tmp`, target);
  },
  async clear() {
    try { fs.rmSync(authSessionPath(), { force: true }); } catch {}
  }
};

const licenseStore = {
  async load() {
    try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(licenseCachePath()))); } catch { return null; }
  },
  async save(value) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('secure_storage_unavailable');
    const target = licenseCachePath();
    fs.writeFileSync(`${target}.tmp`, safeStorage.encryptString(JSON.stringify(value)));
    fs.renameSync(`${target}.tmp`, target);
  },
  async clear() { try { fs.rmSync(licenseCachePath(), { force: true }); } catch {} }
};

function normalizeProfiles(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ACCOUNTS).filter((item) => item && typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(item.id)).map((item, index) => ({
    id: item.id,
    slot: index,
    label: typeof item.label === 'string' ? item.label.slice(0, 60) : `Conta ${index + 1}`,
    enabled: item.enabled !== false
  }));
}

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
  gameViews = new GameViewManager({ window: mainWindow, WebContentsView, session, gameOrigin: GAME_ORIGIN, maxAccounts: MAX_ACCOUNTS, openExternal: (url) => { try { shell.openExternal(url); } catch {} } });
  gameViews.on('status', (payload) => mainWindow.webContents.send('account:status', payload));
  gameViews.on('created', (payload) => { const surface = gameViews.getSurface(payload.id); if (surface) { const adapter = new GameAdapter({ accountId: payload.id, surface, allowedOrigin: GAME_ORIGIN }); gameAdapters.set(payload.id, adapter); const poller = new AccountStatePoller({ accountId: payload.id, adapter }); poller.on('state', (state) => mainWindow.webContents.send('account:state-updated', state)); poller.on('error', (error) => mainWindow.webContents.send('account:state-error', error)); accountPollers.set(payload.id, poller); poller.start(); } mainWindow.webContents.send('account:created', payload); });
  gameViews.on('status', (payload) => { if (payload.status === 'login_required') gameAdapters.get(payload.id)?.bootstrap().catch(() => {}); });
  gameViews.on('status', (payload) => { const poller = accountPollers.get(payload.id); if (!poller) return; if (payload.status === 'closed') poller.stop(); if (payload.status === 'opened') poller.start(); });
  gameViews.on('removed', (payload) => { accountPollers.get(payload.id)?.dispose(); accountPollers.delete(payload.id); gameAdapters.delete(payload.id); mainWindow.webContents.send('account:removed', payload); });
}

function createAuthRuntime() {
  const baseUrl = String(process.env.DARKGRID_AUTH_URL || '').trim();
  const publicKey = String(process.env.DARKGRID_LICENSE_PUBLIC_KEY || '').replace(/\\n/g, '\n');
  if (!baseUrl || !publicKey) return null;
  try { return new AuthRuntime({ service: new AuthService({ baseUrl, tokenStore }), publicKey, licenseStore }); } catch { return null; }
}

ipcMain.handle('app:info', (event) => isTrustedUi(event) ? ({ version: app.getVersion(), platform: process.platform }) : null);
ipcMain.handle('auth:status', async (event) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; if (!authRuntime) return { ok: false, reason: 'auth_server_not_configured' }; try { return await authRuntime.getStatus(); } catch (cause) { return { ok: false, reason: cause.code || 'auth_required' }; } });
ipcMain.handle('auth:login', async (event, email, password) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; if (!authRuntime) return { ok: false, reason: 'auth_server_not_configured' }; try { return await authRuntime.login(email, password); } catch (cause) { return { ok: false, reason: cause.code || cause.message || 'auth_failed' }; } });
ipcMain.handle('auth:logout', async (event) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; if (!authRuntime) return { ok: true }; try { return await authRuntime.logout(); } catch (cause) { return { ok: false, reason: cause.code || 'logout_failed' }; } });

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

ipcMain.handle('profiles:load', (event) => {
  if (!isTrustedUi(event)) return [];
  try { return normalizeProfiles(JSON.parse(fs.readFileSync(profilesPath(), 'utf8'))); } catch { return []; }
});
ipcMain.handle('profiles:save', (event, profiles) => {
  if (!isTrustedUi(event)) return false;
  try {
    const target = profilesPath();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(`${target}.tmp`, JSON.stringify(normalizeProfiles(profiles), null, 2));
    fs.renameSync(`${target}.tmp`, target);
    return true;
  } catch { return false; }
});

ipcMain.handle('account:add', (event, payload) => {
  if (!isTrustedUi(event) || !gameViews) return { ok: false, reason: 'forbidden' };
  return gameViews.add(payload || {});
});
ipcMain.handle('account:open', (event, id) => isTrustedUi(event) && gameViews ? gameViews.open(String(id)) : { ok: false, reason: 'forbidden' });
ipcMain.handle('account:close', (event, id) => isTrustedUi(event) && gameViews ? gameViews.close(String(id)) : { ok: false, reason: 'forbidden' });
ipcMain.handle('account:remove', (event, id) => isTrustedUi(event) && gameViews ? gameViews.remove(String(id)) : { ok: false, reason: 'forbidden' });
ipcMain.handle('account:layout', (event, layout) => isTrustedUi(event) && gameViews ? gameViews.setLayout(layout) : false);
ipcMain.handle('account:state', async (event, id) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; const adapter = gameAdapters.get(String(id)); if (!adapter) return { ok: false, reason: 'account_not_found' }; try { return { ok: true, state: await adapter.getState() }; } catch (cause) { return { ok: false, reason: cause.code || 'state_failed' }; } });
ipcMain.handle('account:action', async (event, id, action, input) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; const adapter = gameAdapters.get(String(id)); if (!adapter || !['openDepot', 'openMarket', 'travelToHunt', 'returnToLastHunt', 'buyBalls', 'sellItems', 'sellPokemon', 'sellStone'].includes(String(action))) return { ok: false, reason: 'action_not_allowed' }; try { return { ok: true, result: await adapter[action](input || {}) }; } catch (cause) { return { ok: false, reason: cause.code || 'action_failed' }; } });

app.whenReady().then(() => {
  authRuntime = createAuthRuntime();
  for (let i = 1; i <= MAX_ACCOUNTS; i++) {
    try { session.fromPartition(`persist:darkgrid-account-${i}`).setPermissionRequestHandler((_wc, _permission, callback) => callback(false)); } catch {}
  }
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { try { gameViews?.destroy(); } catch {} });
