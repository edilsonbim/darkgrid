'use strict';

const { GameAdapter } = require('./game-adapter');

// Compatibilidade de nomenclatura: o contrato antigo agora usa o adaptador versionado.
class GameClient extends GameAdapter {
  constructor(options) {
    if (options && options.surface && options.accountId && options.allowedOrigin) {
      super(options);
      return;
    }
    const legacySurface = options;
    super({
      accountId: legacySurface?.id || 'legacy-client',
      surface: { getOrigin: () => 'https://poke.idleworld.online', isDestroyed: () => false, execute: (...args) => legacySurface.execute(...args) },
      allowedOrigin: 'https://poke.idleworld.online'
    });
    this.surface = legacySurface;
  }
  buyBalls(input) { return super.buyBalls(input); }
  sellItems(input) { return super.sellItems(input); }
  sellPokemon(pokemon) { return super.sellPokemon(pokemon); }
  returnToLastHunt(input) { return super.returnToLastHunt(input); }
  async recover() { return this.reload(); }
}

module.exports = { GameClient };
