'use strict';

const { app, BrowserWindow, WebContentsView, ipcMain, safeStorage, session, shell, dialog, Notification, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { trustedUiUrl, isTrustedUiUrl } = require('./trusted-ui');
const { GAME_ORIGIN, MAX_ACCOUNTS } = require('../shared/constants');
const { GameViewManager } = require('./game-view-manager');
const { GameAdapter } = require('../game/game-adapter');
const { AccountStatePoller } = require('./account-state-poller');
const { AuthService } = require('./auth-service');
const { AuthRuntime } = require('./auth-runtime');
const { HuntHistoryStore } = require('./hunt-history-store');
const { AlertEngine, DEFAULT_ALERT_CONFIG, normalizeAlertConfig } = require('../shared/alert-engine');
const { historyToCsv } = require('../shared/history-csv');
const { calculateTierList } = require('../shared/tierlist');
const { projectPokemon } = require('../shared/iv-math');
const { postDiscordWebhook, validateWebhookUrl } = require('./discord-webhook');

let mainWindow;
let gameViews;
const gameAdapters = new Map();
const accountPollers = new Map();
let authRuntime;
let huntHistory;
let alertEngine;
let tray;
let isQuitting = false;
// Temporário para a fase de desenvolvimento: reative com DARKGRID_AUTH_DISABLED=0.
const AUTH_DISABLED = process.env.DARKGRID_AUTH_DISABLED !== '0';
const rendererUrl = trustedUiUrl(path.join(__dirname, '../renderer/index.html'));

function isTrustedUi(event) {
  try { return isTrustedUiUrl(event.senderFrame?.url, rendererUrl); } catch { return false; }
}

function createTray() {
  if (tray) return;
  const icon = nativeImage.createFromPath(path.join(__dirname, '../renderer/assets/darkgrid-pokeball.png'));
  tray = new Tray(icon);
  tray.setToolTip('DarkGrid');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mostrar DarkGrid', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Sair', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('click', () => { if (mainWindow?.isVisible()) mainWindow.hide(); else { mainWindow?.show(); mainWindow?.focus(); } });
}

function credentialsPath() { return path.join(app.getPath('userData'), 'credentials.enc'); }
function profilesPath() { return path.join(app.getPath('userData'), 'account-profiles.json'); }
function authSessionPath() { return path.join(app.getPath('userData'), 'auth-session.enc'); }
function licenseCachePath() { return path.join(app.getPath('userData'), 'license-cache.enc'); }
function authConfigPath() { return path.join(app.getPath('userData'), 'auth-config.json'); }
function deviceIdPath() { return path.join(app.getPath('userData'), 'device-id.enc'); }
function huntHistoryPath() { return path.join(app.getPath('userData'), 'hunt-history.json'); }
function alertConfigPath() { return path.join(app.getPath('userData'), 'alert-config.json'); }
function discordWebhookPath() { return path.join(app.getPath('userData'), 'discord-webhook.enc'); }
function loadAlertConfig() { try { return normalizeAlertConfig(JSON.parse(fs.readFileSync(alertConfigPath(), 'utf8'))); } catch { return { ...DEFAULT_ALERT_CONFIG }; } }
function saveAlertConfig(config) { try { const target = alertConfigPath(); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(`${target}.tmp`, JSON.stringify(normalizeAlertConfig(config), null, 2)); fs.renameSync(`${target}.tmp`, target); return true; } catch { return false; } }
function loadDiscordWebhook() { if (!safeStorage.isEncryptionAvailable()) return ''; try { const value = safeStorage.decryptString(fs.readFileSync(discordWebhookPath())).trim(); return validateWebhookUrl(value) ? value : ''; } catch { return ''; } }
function saveDiscordWebhook(value) { if (!validateWebhookUrl(value) || !safeStorage.isEncryptionAvailable()) return false; try { const target = discordWebhookPath(); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(`${target}.tmp`, safeStorage.encryptString(String(value).trim())); fs.renameSync(`${target}.tmp`, target); return true; } catch { return false; } }
function clearDiscordWebhook() { try { fs.rmSync(discordWebhookPath(), { force: true }); } catch {} }
function loadAuthConfig() { try { const value = JSON.parse(fs.readFileSync(authConfigPath(), 'utf8')); return value && typeof value === 'object' ? { url: String(value.url || '').trim(), publicKey: String(value.publicKey || '') } : null; } catch { return null; } }
function saveAuthConfig(url, publicKey) { try { const target = authConfigPath(); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(`${target}.tmp`, JSON.stringify({ url: String(url).trim(), publicKey: String(publicKey) })); fs.renameSync(`${target}.tmp`, target); } catch {} }
function sendAlerts(alerts) {
  for (const alert of alerts || []) {
    mainWindow?.webContents.send('account:alert', alert);
    if (alertEngine?.getConfig().nativeNotifications !== false && Notification.isSupported()) {
      try { new Notification({ title: 'DarkGrid', body: alert.message, silent: false }).show(); } catch {}
    }
    if (alertEngine?.getConfig().discordNotifications === true) postDiscordWebhook(loadDiscordWebhook(), alert.message).catch(() => {});
  }
}

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

function installationDeviceId() {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('secure_storage_unavailable');
  try {
    const stored = safeStorage.decryptString(fs.readFileSync(deviceIdPath())).trim();
    if (/^[a-f0-9-]{20,128}$/i.test(stored)) return stored;
  } catch {}
  const deviceId = crypto.randomUUID();
  const target = deviceIdPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(`${target}.tmp`, safeStorage.encryptString(deviceId));
  fs.renameSync(`${target}.tmp`, target);
  return deviceId;
}

function normalizeProfiles(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ACCOUNTS).filter((item) => item && typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(item.id)).map((item, index) => ({
    id: item.id,
    slot: index,
    label: typeof item.label === 'string' ? item.label.slice(0, 60) : `Conta ${index + 1}`,
    enabled: item.enabled !== false
  }));
}

function normalizeCredentials(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ACCOUNTS).filter((item) => item && typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(item.id)).map((item) => ({ id: item.id, username: String(item.username || '').slice(0, 160), password: String(item.password || '').slice(0, 512) })).filter((item) => item.username && item.password);
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
    icon: path.join(__dirname, '../renderer/assets/darkgrid-pokeball.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.on('close', (event) => { if (!isQuitting) { event.preventDefault(); mainWindow.hide(); } });
  mainWindow.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) mainWindow.show(); });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try { shell.openExternal(url); } catch {}
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) { event.preventDefault(); try { shell.openExternal(url); } catch {} }
  });
  gameViews = new GameViewManager({ window: mainWindow, WebContentsView, session, gameOrigin: GAME_ORIGIN, maxAccounts: MAX_ACCOUNTS, openExternal: (url) => { try { shell.openExternal(url); } catch {} } });
  gameViews.on('status', (payload) => mainWindow.webContents.send('account:status', payload));
  gameViews.on('created', (payload) => { const surface = gameViews.getSurface(payload.id); if (surface) { const adapter = new GameAdapter({ accountId: payload.id, surface, allowedOrigin: GAME_ORIGIN }); gameAdapters.set(payload.id, adapter); const poller = new AccountStatePoller({ accountId: payload.id, adapter, recover: () => adapter.recover(), shouldRecover: (cause) => adapter.shouldAutoRecover(cause) }); poller.on('state', (state) => { const entry = huntHistory?.record(state.state); if (entry) mainWindow.webContents.send('history:updated', entry); sendAlerts(alertEngine?.process(state.state)); mainWindow.webContents.send('account:state-updated', state); }); poller.on('error', (error) => mainWindow.webContents.send('account:state-error', error)); poller.on('stalled', (payload) => { sendAlerts(alertEngine?.processStalled(payload)); mainWindow.webContents.send('account:stalled', payload); }); poller.on('recovery', (recovery) => mainWindow.webContents.send('account:status', { id: recovery.accountId, status: recovery.status, updatedAt: Date.now(), code: recovery.code })); accountPollers.set(payload.id, poller); poller.start(); } mainWindow.webContents.send('account:created', payload); });
  gameViews.on('status', (payload) => { if (payload.status === 'login_required') gameAdapters.get(payload.id)?.bootstrap().catch(() => {}); });
  gameViews.on('status', (payload) => { const poller = accountPollers.get(payload.id); if (!poller) return; if (payload.status === 'closed') poller.stop(); if (payload.status === 'opened') poller.start(); });
  gameViews.on('removed', (payload) => { accountPollers.get(payload.id)?.dispose(); accountPollers.delete(payload.id); gameAdapters.delete(payload.id); mainWindow.webContents.send('account:removed', payload); });
}

function createAuthRuntime() {
  const cached = loadAuthConfig() || {};
  const baseUrl = String(process.env.DARKGRID_AUTH_URL || cached.url || '').trim();
  const publicKey = String(process.env.DARKGRID_LICENSE_PUBLIC_KEY || cached.publicKey || '').replace(/\\n/g, '\n');
  if (!baseUrl || !publicKey) return null;
  const allowInsecureLocalhost = process.env.DARKGRID_ALLOW_INSECURE_LOCALHOST === '1' || process.env.NODE_ENV === 'development' || cached.url === baseUrl;
  try { saveAuthConfig(baseUrl, publicKey); return new AuthRuntime({ service: new AuthService({ baseUrl, tokenStore, allowInsecureLocalhost }), publicKey, licenseStore, deviceId: installationDeviceId() }); } catch { return null; }
}

ipcMain.handle('app:info', (event) => isTrustedUi(event) ? ({ version: app.getVersion(), platform: process.platform }) : null);
ipcMain.handle('auth:status', async (event) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; if (AUTH_DISABLED) return { ok: true, bypass: true, offline: true, plan: 'local-development' }; if (!authRuntime) return { ok: false, reason: 'auth_server_not_configured' }; try { return await authRuntime.getStatus(); } catch (cause) { return { ok: false, reason: cause.code || 'auth_required' }; } });
ipcMain.handle('auth:login', async (event, email, password) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; if (AUTH_DISABLED) return { ok: true, license: { ok: true, bypass: true, offline: true, plan: 'local-development' } }; if (!authRuntime) return { ok: false, reason: 'auth_server_not_configured' }; try { return await authRuntime.login(email, password); } catch (cause) { return { ok: false, reason: cause.code || cause.message || 'auth_failed' }; } });
ipcMain.handle('auth:logout', async (event) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; if (AUTH_DISABLED) return { ok: true, bypass: true }; if (!authRuntime) return { ok: true }; try { return await authRuntime.logout(); } catch (cause) { return { ok: false, reason: cause.code || 'logout_failed' }; } });
ipcMain.handle('analytics:tierlist', (event, catalog, level) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; try { return { ok: true, rows: calculateTierList(catalog, level) }; } catch { return { ok: false, reason: 'tierlist_failed' }; } });
ipcMain.handle('analytics:iv', (event, pokemon) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; try { return { ok: true, result: projectPokemon(pokemon || {}) }; } catch { return { ok: false, reason: 'iv_failed' }; } });

ipcMain.handle('credentials:load', (event) => {
  if (!isTrustedUi(event)) return [];
  if (!safeStorage.isEncryptionAvailable()) return [];
  try {
    const raw = fs.readFileSync(credentialsPath());
    const json = safeStorage.decryptString(raw);
    const value = JSON.parse(json);
    return normalizeCredentials(value);
  } catch { return []; }
});

ipcMain.handle('credentials:save', (event, accounts) => {
  if (!isTrustedUi(event) || !Array.isArray(accounts)) return false;
  try {
    const value = JSON.stringify(normalizeCredentials(accounts));
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
ipcMain.handle('history:load', (event) => isTrustedUi(event) && huntHistory ? huntHistory.getAll() : []);
ipcMain.handle('history:export', async (event) => {
  if (!isTrustedUi(event) || !huntHistory || !mainWindow) return { ok: false, reason: 'forbidden' };
  const result = await dialog.showSaveDialog(mainWindow, { title: 'Exportar histórico do DarkGrid', defaultPath: 'darkgrid-hunts.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  try { fs.writeFileSync(result.filePath, historyToCsv(huntHistory.getAll()), 'utf8'); return { ok: true, filePath: result.filePath }; } catch { return { ok: false, reason: 'history_export_failed' }; }
});
ipcMain.handle('alerts:load', (event) => isTrustedUi(event) && alertEngine ? alertEngine.getConfig() : { ...DEFAULT_ALERT_CONFIG });
ipcMain.handle('alerts:save', (event, config) => { if (!isTrustedUi(event) || !alertEngine) return { ok: false, reason: 'forbidden' }; const normalized = alertEngine.configure(config || {}); return saveAlertConfig(normalized) ? { ok: true, config: normalized } : { ok: false, reason: 'alert_config_save_failed' }; });
ipcMain.handle('discord:status', (event) => isTrustedUi(event) ? { ok: true, configured: Boolean(loadDiscordWebhook()) } : { ok: false, reason: 'forbidden' });
ipcMain.handle('discord:save', (event, webhookUrl) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; return saveDiscordWebhook(webhookUrl) ? { ok: true, configured: true } : { ok: false, reason: 'invalid_or_insecure_webhook' }; });
ipcMain.handle('discord:clear', (event) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; clearDiscordWebhook(); return { ok: true, configured: false }; });
ipcMain.handle('app:autostart:get', (event) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; if (process.platform !== 'win32') return { ok: false, supported: false, enabled: false }; try { return { ok: true, supported: true, enabled: Boolean(app.getLoginItemSettings().openAtLogin) }; } catch { return { ok: false, supported: true, enabled: false }; } });
ipcMain.handle('app:autostart:set', (event, enabled) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; if (process.platform !== 'win32') return { ok: false, supported: false, enabled: false }; try { app.setLoginItemSettings({ openAtLogin: Boolean(enabled), args: ['--hidden'] }); return { ok: true, supported: true, enabled: Boolean(app.getLoginItemSettings().openAtLogin) }; } catch { return { ok: false, supported: true, enabled: false }; } });

ipcMain.handle('account:add', (event, payload) => {
  if (!isTrustedUi(event) || !gameViews) return { ok: false, reason: 'forbidden' };
  return gameViews.add(payload || {});
});
ipcMain.handle('account:open', (event, id) => isTrustedUi(event) && gameViews ? gameViews.open(String(id)) : { ok: false, reason: 'forbidden' });
ipcMain.handle('account:close', (event, id) => isTrustedUi(event) && gameViews ? gameViews.close(String(id)) : { ok: false, reason: 'forbidden' });
ipcMain.handle('account:remove', (event, id) => isTrustedUi(event) && gameViews ? gameViews.remove(String(id)) : { ok: false, reason: 'forbidden' });
ipcMain.handle('account:layout', (event, layout) => isTrustedUi(event) && gameViews ? gameViews.setLayout(layout) : false);
ipcMain.handle('account:layout-mode', (event, mode) => isTrustedUi(event) && gameViews ? gameViews.setLayoutMode(mode) : false);
ipcMain.handle('account:visibility', (event, visible) => isTrustedUi(event) && gameViews ? gameViews.setVisibleAll(visible) : false);
ipcMain.handle('account:maximized', (event, id) => isTrustedUi(event) && gameViews ? gameViews.setMaximized(id == null || id === '' ? null : String(id)) : false);
ipcMain.handle('account:zoom', (event, id, factor) => isTrustedUi(event) && gameViews ? gameViews.setZoom(String(id), factor) : false);
ipcMain.handle('account:reload', (event, id) => isTrustedUi(event) && gameViews ? gameViews.reload(String(id)) : false);
ipcMain.handle('account:state', async (event, id) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; const adapter = gameAdapters.get(String(id)); if (!adapter) return { ok: false, reason: 'account_not_found' }; try { return { ok: true, state: await adapter.getState() }; } catch (cause) { return { ok: false, reason: cause.code || 'state_failed' }; } });
ipcMain.handle('account:action', async (event, id, action, input) => { if (!isTrustedUi(event)) return { ok: false, reason: 'forbidden' }; const adapter = gameAdapters.get(String(id)); if (!adapter || !['openDepot', 'readDepot', 'readPokemon', 'readHunts', 'previewSellItems', 'previewSellPokemon', 'openMarket', 'travelToHunt', 'returnToLastHunt', 'buyBalls', 'sellItems', 'sellPokemon', 'sellStone', 'detectGameLogin', 'fillGameCredentials', 'submitGameLogin', 'runUserScript'].includes(String(action))) return { ok: false, reason: 'action_not_allowed' }; try { return { ok: true, result: await adapter[action](input || {}) }; } catch (cause) { return { ok: false, reason: cause.code || cause.message || 'action_failed' }; } });

app.whenReady().then(() => {
  authRuntime = createAuthRuntime();
  huntHistory = new HuntHistoryStore({ filePath: huntHistoryPath() });
  alertEngine = new AlertEngine(loadAlertConfig());
  for (let i = 1; i <= MAX_ACCOUNTS; i++) {
    try { session.fromPartition(`persist:darkgrid-account-${i}`).setPermissionRequestHandler((_wc, _permission, callback) => callback(false)); } catch {}
  }
  createWindow();
  createTray();
});

app.on('activate', () => { mainWindow?.show(); mainWindow?.focus(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !tray) app.quit(); });
app.on('before-quit', () => { isQuitting = true; try { gameViews?.destroy(); } catch {} try { tray?.destroy(); } catch {} });
