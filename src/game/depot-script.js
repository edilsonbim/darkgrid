'use strict';

const READ_DEPOT_SCRIPT = String.raw`(async()=>{try{const response=await fetch('/api/game/depot',{credentials:'include'});if(response.status===401)return{ok:false,reason:'game_auth_required'};const data=await response.json().catch(()=>null);if(!response.ok||!data||!Array.isArray(data.depot))return{ok:false,reason:'depot_read_failed'};const items=data.depot.slice(0,500).map(item=>({itemId:String(item&&item.itemId||''),name:String(item&&item.name||'').slice(0,80),category:String(item&&item.category||'').slice(0,40),quantity:Math.max(0,Number(item&&item.quantity)||0)})).filter(item=>item.itemId&&item.quantity>0);return{ok:true,items}}catch(error){return{ok:false,reason:'depot_read_failed'}}})()`;

module.exports = { READ_DEPOT_SCRIPT };
