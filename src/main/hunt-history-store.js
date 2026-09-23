'use strict';

const fs = require('node:fs');
const path = require('node:path');

const VERSION = 1;
const DEFAULT_MAX_ENTRIES = 150;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function text(value, max = 80) {
  return String(value || '').trim().slice(0, max);
}

class HuntHistoryStore {
  constructor({ filePath, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
    if (!filePath) throw new TypeError('HuntHistoryStore requer filePath');
    this.filePath = filePath;
    this.maxEntries = Math.max(1, Math.floor(Number(maxEntries) || DEFAULT_MAX_ENTRIES));
    this.entries = [];
    this.active = new Map();
    this.load();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      const entries = Array.isArray(raw?.entries) ? raw.entries : [];
      this.entries = entries.slice(-this.maxEntries).filter((entry) => entry && typeof entry === 'object').map((entry) => this.#normalizeEntry(entry));
      const active = raw?.active && typeof raw.active === 'object' ? raw.active : {};
      this.active = new Map(Object.entries(active).filter(([id, state]) => state && typeof state === 'object').map(([id, state]) => [id, this.#normalizeActive(state)]));
    } catch {
      this.entries = [];
      this.active = new Map();
    }
    return this.getAll();
  }

  record(snapshot) {
    const accountId = text(snapshot?.accountId, 64);
    const huntSlug = text(snapshot?.hunt?.slug, 100);
    if (!accountId || !huntSlug) return null;
    const next = this.#normalizeActive({
      name: snapshot?.name,
      huntSlug,
      huntName: snapshot?.hunt?.name || huntSlug,
      metrics: snapshot?.metrics,
      updatedAt: snapshot?.updatedAt
    });
    const previous = this.active.get(accountId);
    let entry = null;
    if (previous && previous.huntSlug !== next.huntSlug && previous.metrics.kills > 0) {
      entry = this.#normalizeEntry({
        accountId,
        accountName: previous.name,
        huntSlug: previous.huntSlug,
        huntName: previous.huntName,
        finishedAt: Date.now(),
        kills: previous.metrics.kills,
        xp: previous.metrics.xp,
        captures: previous.metrics.captures,
        shiny: previous.metrics.shiny,
        durationSeconds: previous.metrics.seconds
      });
      this.entries.push(entry);
      this.entries = this.entries.slice(-this.maxEntries);
    }
    this.active.set(accountId, next);
    this.#persist();
    return entry;
  }

  getAll() {
    return this.entries.slice().reverse().map((entry) => ({ ...entry }));
  }

  #normalizeActive(value) {
    const metrics = value?.metrics && typeof value.metrics === 'object' ? value.metrics : {};
    return {
      name: text(value?.name, 80),
      huntSlug: text(value?.huntSlug, 100),
      huntName: text(value?.huntName || value?.huntSlug, 100),
      metrics: {
        kills: Math.max(0, finite(metrics.kills)),
        xp: Math.max(0, finite(metrics.xp)),
        captures: Math.max(0, finite(metrics.captures)),
        shiny: Math.max(0, finite(metrics.shiny)),
        seconds: Math.max(0, finite(metrics.seconds))
      },
      updatedAt: Math.max(0, finite(value?.updatedAt))
    };
  }

  #normalizeEntry(value) {
    return {
      accountId: text(value?.accountId, 64),
      accountName: text(value?.accountName, 80),
      huntSlug: text(value?.huntSlug, 100),
      huntName: text(value?.huntName || value?.huntSlug, 100),
      finishedAt: Math.max(0, finite(value?.finishedAt, Date.now())),
      kills: Math.max(0, finite(value?.kills)),
      xp: Math.max(0, finite(value?.xp)),
      captures: Math.max(0, finite(value?.captures)),
      shiny: Math.max(0, finite(value?.shiny)),
      durationSeconds: Math.max(0, finite(value?.durationSeconds))
    };
  }

  #persist() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const active = Object.fromEntries(this.active.entries());
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify({ version: VERSION, entries: this.entries, active }, null, 2));
      fs.renameSync(tempPath, this.filePath);
    } catch {
      // Histórico é auxiliar; uma falha de disco não pode interromper o farm.
    }
  }
}

module.exports = { HuntHistoryStore };
