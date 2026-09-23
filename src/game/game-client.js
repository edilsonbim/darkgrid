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
  async buyBalls() { throw Object.assign(new Error('Compra de bolas entra na fase de operações autenticadas'), { code: 'FEATURE_NOT_READY' }); }
  async sellItems() { throw Object.assign(new Error('Venda de itens entra na fase de operações autenticadas'), { code: 'FEATURE_NOT_READY' }); }
  async sellPokemon() { throw Object.assign(new Error('Venda de Pokémon entra na fase de operações autenticadas'), { code: 'FEATURE_NOT_READY' }); }
  async returnToLastHunt() { throw Object.assign(new Error('Retorno à hunt entra na fase de recuperação confirmada'), { code: 'FEATURE_NOT_READY' }); }
  async recover() { throw Object.assign(new Error('Recuperação entra na fase de watchdog por conta'), { code: 'FEATURE_NOT_READY' }); }
}

module.exports = { GameClient };
