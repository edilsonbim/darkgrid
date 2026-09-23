'use strict';

// Contrato comum para WebviewGameSurface e futura WebContentsGameSurface.
// O dashboard não deve conhecer a implementação do painel remoto.
class GameSurface {
  constructor(id, partition) { this.id = id; this.partition = partition; }
  async load() { throw new Error('GameSurface.load não implementado'); }
  show() { throw new Error('GameSurface.show não implementado'); }
  hide() { throw new Error('GameSurface.hide não implementado'); }
  focus() { throw new Error('GameSurface.focus não implementado'); }
  reload() { throw new Error('GameSurface.reload não implementado'); }
  async execute(_script) { throw new Error('GameSurface.execute não implementado'); }
  async destroy() { throw new Error('GameSurface.destroy não implementado'); }
}

module.exports = { GameSurface };
