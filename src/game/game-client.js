'use strict';

class GameClient {
  constructor(surface) { this.surface = surface; }
  async getState() { throw new Error('GameClient.getState ainda depende do adaptador do jogo'); }
  async openDepot() { throw new Error('GameClient.openDepot ainda depende do adaptador do jogo'); }
  async openMarket() { throw new Error('GameClient.openMarket ainda depende do adaptador do jogo'); }
  async buyBalls(_input) { throw new Error('GameClient.buyBalls ainda depende do adaptador do jogo'); }
  async sellItems(_input) { throw new Error('GameClient.sellItems ainda depende do adaptador do jogo'); }
  async sellPokemon(_input) { throw new Error('GameClient.sellPokemon ainda depende do adaptador do jogo'); }
  async travelToHunt(_hunt) { throw new Error('GameClient.travelToHunt ainda depende do adaptador do jogo'); }
  async returnToLastHunt() { throw new Error('GameClient.returnToLastHunt ainda depende do adaptador do jogo'); }
  async recover() { throw new Error('GameClient.recover ainda depende do adaptador do jogo'); }
}

module.exports = { GameClient };
