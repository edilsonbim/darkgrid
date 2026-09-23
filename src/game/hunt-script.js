'use strict';

const READ_HUNTS_SCRIPT = String.raw`(()=>{try{const raw=window.__darkGrid&&window.__darkGrid.api&&window.__darkGrid.api['/api/game/map-markers'];const list=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.markers)?raw.markers:(raw&&Array.isArray(raw.hunts)?raw.hunts:[]));const hunts=list.slice(0,500).map(item=>({slug:String(item&&item.slug||item&&item.hunt||'').slice(0,100),name:String(item&&item.name||item&&item.title||item&&item.slug||'').slice(0,100),level:Math.max(0,Number(item&&item.level||item&&item.requiredLevel)||0),region:String(item&&item.region||'').slice(0,40)})).filter(item=>item.slug);return{ok:true,hunts}}catch(error){return{ok:false,reason:'hunt_catalog_unavailable'}}})()`;

module.exports = { READ_HUNTS_SCRIPT };
