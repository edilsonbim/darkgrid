'use strict';

const READ_POKEMON_SCRIPT = String.raw`(()=>{try{const list=window.__darkGrid&&window.__darkGrid.ws&&window.__darkGrid.ws.pokes&&Array.isArray(window.__darkGrid.ws.pokes.list)?window.__darkGrid.ws.pokes.list:[];const items=list.slice(0,500).map(item=>({id:String(item&&item.id||'').slice(0,64),name:String(item&&item.name||item&&item.speciesName||'Pokémon').slice(0,60),level:Math.max(0,Number(item&&item.level)||0),sellValue:Math.max(0,Number(item&&item.sellValue)||0),ivTotal:Math.max(0,Number(item&&item.ivTotal)||0),quality:Math.max(0,Number(item&&item.quality)||0),team:Boolean(item&&item.team),leader:Boolean(item&&item.leader),starter:Boolean(item&&item.starter),shiny:Boolean(item&&item.shiny),locked:Boolean(item&&item.locked)})).filter(item=>item.id);return{ok:true,items}}catch(error){return{ok:false,reason:'pokemon_read_failed'}}})()`;

module.exports = { READ_POKEMON_SCRIPT };
