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
  async returnToLastHunt() { throw Object.assign(new Error('Retorno à hunt entra na fase de recuperação confirmada'), { code: 'FEATURE_NOT_READY' }); }
  async recover() { throw Object.assign(new Error('Recuperação entra na fase de watchdog por conta'), { code: 'FEATURE_NOT_READY' }); }
}

module.exports = { GameClient };
