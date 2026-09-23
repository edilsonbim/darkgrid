'use strict';

const GO_TOWN_SCRIPT = String.raw`(async()=>{const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),started=Date.now(),timeout=10000;const visible=x=>{if(!x)return false;const box=x.getBoundingClientRect();return box.width>0&&box.height>0&&getComputedStyle(x).visibility!=='hidden'};const inTown=()=>[...document.querySelectorAll('button.npc-plate-btn,[class*="npc-plate"]')].some(x=>visible(x)&&/market|mercado|depot|depósito|deposito/i.test(x.textContent||''));if(inTown())return{ok:true,already:true};const home=[...document.querySelectorAll('[data-guide="dock-home"],[data-guide*="home" i],button')].find(x=>!x.disabled&&visible(x)&&/casa|home|cidade|town/i.test((x.textContent||'')+' '+(x.getAttribute('data-guide')||'')));if(!home)return{ok:false,reason:'town_control_missing'};home.click();while(Date.now()-started<timeout){if(inTown())return{ok:true};await wait(150)}return{ok:false,reason:'town_not_confirmed'}})()`;

module.exports = { GO_TOWN_SCRIPT };
