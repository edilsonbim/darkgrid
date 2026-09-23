'use strict';

const PROTECTED_ITEM_WORDS = ['boss', 'key', 'card', 'picture', 'strange pheromone'];
const PROTECTED_CATEGORIES = new Set(['heal', 'revive', 'stone']);

function isProtectedItem(item, protectedIds = []) {
  const id = String(item?.itemId ?? item?.id ?? '');
  const name = String(item?.name || '').toLowerCase();
  const category = String(item?.category || '').toLowerCase();
  return protectedIds.map(String).includes(id) || PROTECTED_CATEGORIES.has(category) || PROTECTED_ITEM_WORDS.some(word => name.includes(word));
}

function selectSellableItems(items, protectedIds = []) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => item && !isProtectedItem(item, protectedIds) && Number(item.quantity ?? item.qty) > 0).map(item => ({ itemId: Number(item.itemId ?? item.id), qty: Math.floor(Number(item.quantity ?? item.qty)) })).filter(item => Number.isInteger(item.itemId) && item.itemId > 0 && item.qty > 0);
}

function isProtectedPokemon(pokemon) {
  return Boolean(pokemon?.team || pokemon?.leader || pokemon?.starter || pokemon?.shiny || pokemon?.locked) || Number(pokemon?.sellValue) <= 0 || Number(pokemon?.ivTotal) >= 150 || Number(pokemon?.quality) >= 1.7;
}

function selectSellablePokemon(pokemon) {
  if (!Array.isArray(pokemon)) return [];
  return pokemon.filter(item => item?.id != null && !isProtectedPokemon(item)).map(item => String(item.id));
}

module.exports = { isProtectedItem, selectSellableItems, isProtectedPokemon, selectSellablePokemon };
