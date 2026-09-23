'use strict';

function travelScript(slug, name, timeoutMs = 12000) {
  const safeSlug = JSON.stringify(String(slug || ''));
  const safeName = JSON.stringify(String(name || ''));
  const safeTimeout = Math.max(1000, Math.min(30000, Number(timeoutMs) || 12000));
  return String.raw`(async()=>{const P=window.__darkGrid,slug=${safeSlug},name=${safeName},timeout=${safeTimeout};if(!slug)return{ok:false,reason:'hunt_missing'};const norm=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();const started=Date.now(),target=norm(name||slug),confirmed=()=>String(P&&P.lastSlug||'')===slug||!![...document.querySelectorAll('.map-window button.hunt-marker,.hunt-marker')].find(x=>x.classList.contains('here')&&(norm(x.textContent||x.title||'').includes(target)||norm(x.dataset&&x.dataset.guide).includes(target)));const replace=(v,old,next)=>{if(typeof v==='string')return v===old?next:v.replace(old,next);if(Array.isArray(v))return v.map(x=>replace(x,old,next));if(v&&typeof v==='object'){const out={};Object.keys(v).forEach(k=>out[k]=replace(v[k],old,next));return out}return v};let mode='map';if(P&&P.socket&&P.socket.readyState===1&&P.travelTemplate&&P.travelTemplate.json){try{P.socket.send(JSON.stringify(replace(P.travelTemplate.json,P.travelTemplate.oldSlug,slug)));mode='socket'}catch{}}if(mode==='map'){const button=[...document.querySelectorAll('.map-window button.hunt-marker,[data-guide^="hunt-"]')].find(x=>!x.disabled&&(norm(x.textContent||x.title||'').includes(target)||norm(x.dataset&&x.dataset.guide).includes(target)));if(!button)return{ok:false,reason:'hunt_not_found'};button.click()}while(Date.now()-started<timeout){if(confirmed())return{ok:true,mode};await new Promise(resolve=>setTimeout(resolve,150))}return{ok:false,reason:'travel_not_confirmed',mode}})()`;
}

module.exports = { travelScript };
