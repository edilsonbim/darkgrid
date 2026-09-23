'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { GameViewManager } = require('../src/main/game-view-manager');

class FakeContents extends EventEmitter {
  loadURL(url) { this.url = url; return Promise.resolve(); }
  setWindowOpenHandler(handler) { this.openHandler = handler; }
  focus() { this.focused = true; }
  close() { this.closed = true; }
  isDestroyed() { return false; }
  reload() { this.reloaded = true; }
}
class FakeView {
  constructor(options) { this.options = options; this.webContents = new FakeContents(); this.visible = false; this.bounds = null; }
  setVisible(value) { this.visible = value; }
  setBackgroundColor(value) { this.background = value; }
  setBounds(value) { this.bounds = value; }
}

const parent = { contentView: { children: [], addChildView(view) { this.children.push(view); }, removeChildView(view) { this.children = this.children.filter((item) => item !== view); } } };
const manager = new GameViewManager({ window: parent, WebContentsView: FakeView, gameOrigin: 'https://poke.idleworld.online' });
assert.equal(manager.add({ id: 'account-a', slot: 0 }).ok, true);
assert.equal(parent.contentView.children[0].options.webPreferences.backgroundThrottling, false);
assert.equal(manager.add({ id: 'account-a', slot: 0 }).existing, true);
assert.equal(manager.open('account-a').ok, true);
assert.equal(parent.contentView.children[0].visible, true);
assert.equal(parent.contentView.children[0].webContents.focused, true);
assert.equal(manager.setVisibleAll(false), true);
assert.equal(parent.contentView.children[0].visible, false);
assert.equal(manager.setVisibleAll(true), true);
assert.equal(parent.contentView.children[0].visible, true);
assert.equal(manager.setLayout({ x: 10, y: 20, width: 600, height: 400 }), true);
assert.equal(parent.contentView.children[0].bounds.width, 600);
assert.equal(manager.setLayoutMode('column'), true);
assert.equal(manager.setLayoutMode('invalid'), false);
assert.equal(manager.remove('account-a').ok, true);
assert.equal(parent.contentView.children.length, 0);
console.log('DarkGrid game views: sessão, abertura, layout e remoção OK');
