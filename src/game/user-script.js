'use strict';

const MAX_USER_SCRIPT_LENGTH = 200000;

function userScript(source) {
  const code = String(source || '');
  if (!code.trim()) throw new Error('script_empty');
  if (code.length > MAX_USER_SCRIPT_LENGTH) throw new Error('script_too_large');
  return String.raw`(async()=>{try{const fn=new Function(${JSON.stringify(code)});const value=await fn();return{ok:true,result:value===undefined?null:value}}catch(error){return{ok:false,reason:'user_script_failed',message:String(error&&error.message||error).slice(0,240)}}})()`;
}

module.exports = { MAX_USER_SCRIPT_LENGTH, userScript };
