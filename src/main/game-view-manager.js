'use strict';

const { EventEmitter } = require('node:events');

class GameViewManager extends EventEmitter {
  constructor({ window, WebContentsView, session, gameOrigin, maxAccounts = 4, openExternal = () => {} }) {
    super();
    this.window = window;
    this.WebContentsView = WebContentsView;
    this.session = session;
    this.gameOrigin = new URL(gameOrigin).origin;
    this.maxAccounts = maxAccounts;
    this.openExternal = openExternal;
    this.views = new Map();
    this.layout = { x: 250, y: 120, width: 900, height: 650 };
    this.layoutMode = 'grid';
  }

  add({ id, slot }) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(String(id)) || !Number.isInteger(slot) || slot < 0 || slot >= this.maxAccounts) return { ok: false, reason: 'invalid_account' };
    if (this.views.has(id)) return { ok: true, id, existing: true };
    if ([...this.views.values()].some((record) => record.slot === slot)) return { ok: false, reason: 'slot_in_use' };
    const partition = `persist:darkgrid-account-${id}`;
    try { this.session?.fromPartition(partition).setPermissionRequestHandler((_wc, _permission, callback) => callback(false)); } catch {}
    // O farm continua rodando quando o painel fica oculto ou o app é minimizado.
    const view = new this.WebContentsView({ webPreferences: { partition, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
    this.window.contentView.addChildView(view);
    view.setVisible(false);
    view.setBackgroundColor('#080b12');
    const record = { id, slot, partition, view, status: 'loading' };
    this.views.set(id, record);
    this.#wire(record);
    view.webContents.loadURL(`${this.gameOrigin}/login`).catch(() => this.#setStatus(record, 'error'));
    this.#applyBounds(record);
    this.emit('created', { id, slot, partition });
    return { ok: true, id, partition };
  }

  open(id) {
    const record = this.views.get(id);
    if (!record) return { ok: false, reason: 'account_not_found' };
    record.view.setVisible(true);
    this.#applyBounds(record);
    record.view.webContents.focus();
    this.#setStatus(record, 'opened');
    return { ok: true };
  }

  close(id) {
    const record = this.views.get(id);
    if (!record) return { ok: false, reason: 'account_not_found' };
    record.view.setVisible(false);
    this.#setStatus(record, 'closed');
    return { ok: true };
  }

  setVisibleAll(visible) {
    const next = Boolean(visible);
    for (const record of this.views.values()) record.view.setVisible(next);
    return true;
  }

  remove(id) {
    const record = this.views.get(id);
    if (!record) return { ok: false, reason: 'account_not_found' };
    this.window.contentView.removeChildView(record.view);
    try { record.view.webContents.close({ waitForBeforeUnload: false }); } catch {}
    this.views.delete(id);
    this.emit('removed', { id });
    return { ok: true };
  }

  setLayout(layout) {
    if (!layout || !Number.isFinite(layout.x) || !Number.isFinite(layout.y) || !Number.isFinite(layout.width) || !Number.isFinite(layout.height)) return false;
    this.layout = { x: Math.max(0, Math.round(layout.x)), y: Math.max(0, Math.round(layout.y)), width: Math.max(240, Math.round(layout.width)), height: Math.max(180, Math.round(layout.height)) };
    for (const record of this.views.values()) this.#applyBounds(record);
    return true;
  }

  setLayoutMode(mode) {
    if (!['grid', 'row', 'column'].includes(String(mode))) return false;
    this.layoutMode = String(mode);
    for (const record of this.views.values()) this.#applyBounds(record);
    return true;
  }

  destroy() { for (const id of [...this.views.keys()]) this.remove(id); }

  getSurface(id) {
    const record = this.views.get(id);
    if (!record) return null;
    return {
      getOrigin: () => { try { return new URL(record.view.webContents.getURL()).origin; } catch { return ''; } },
      isDestroyed: () => record.view.webContents.isDestroyed(),
      execute: (script) => record.view.webContents.executeJavaScript(script, true),
      reload: () => record.view.webContents.reload()
    };
  }

  #applyBounds(record) {
    const count = Math.max(1, this.views.size);
    const columns = this.layoutMode === 'row' ? count : this.layoutMode === 'column' ? 1 : count === 1 ? 1 : 2;
    const rows = Math.ceil(count / columns);
    const ordered = [...this.views.values()];
    const index = ordered.indexOf(record);
    const gap = 8;
    const width = Math.max(240, Math.floor((this.layout.width - gap * (columns - 1)) / columns));
    const height = Math.max(180, Math.floor((this.layout.height - gap * (rows - 1)) / rows));
    record.view.setBounds({ x: this.layout.x + (index % columns) * (width + gap), y: this.layout.y + Math.floor(index / columns) * (height + gap), width, height });
  }

  #wire(record) {
    const contents = record.view.webContents;
    const allowed = (url) => { try { return new URL(url).origin === this.gameOrigin; } catch { return false; } };
    contents.setWindowOpenHandler(({ url }) => { if (!allowed(url)) this.openExternal(url); return { action: 'deny' }; });
    const guard = (event, url) => { if (!allowed(url) && url !== 'about:blank') { event.preventDefault(); this.openExternal(url); } };
    contents.on('will-navigate', guard);
    contents.on('will-redirect', guard);
    contents.on('did-start-loading', () => this.#setStatus(record, 'loading'));
    contents.on('did-finish-load', () => this.#setStatus(record, 'login_required'));
    contents.on('did-fail-load', (_event, errorCode) => { if (errorCode !== -3) this.#setStatus(record, 'offline'); });
    contents.on('render-process-gone', (_event, details) => { if (details.reason !== 'clean-exit') { this.#setStatus(record, 'error'); setTimeout(() => { try { if (!contents.isDestroyed()) contents.reload(); } catch {} }, 1200); } });
    contents.on('unresponsive', () => this.#setStatus(record, 'error'));
    contents.on('responsive', () => this.#setStatus(record, 'online'));
  }

  #setStatus(record, status) { record.status = status; this.emit('status', { id: record.id, slot: record.slot, status, updatedAt: Date.now() }); }
}

module.exports = { GameViewManager };
