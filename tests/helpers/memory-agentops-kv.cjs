'use strict';
// Offline model of only the three existing agent-operations storage scripts.
// Real Redis integration separately verifies Lua and expiry semantics.
const {CAS,CONFIRM}=require('../../lib/agent-operations-store');
const EXPIRING=CAS.replace('return 1',"redis.call('EXPIRE',KEYS[1],86400); return 1"),expirations=new WeakMap();
function create({rows=new Map(),clock=Date.now}={}){
 if(!expirations.has(rows))expirations.set(rows,new Map());const ttl=expirations.get(rows);
 function current(key){if(ttl.has(key)&&clock()>=ttl.get(key)){rows.delete(key);ttl.delete(key);}return rows.get(key)??null;}
 return{get:async key=>current(key),eval:async(script,keys,args)=>{
  if(![CAS,CONFIRM,EXPIRING].includes(script)||!Array.isArray(keys)||keys.length!==1||!Array.isArray(args)||args.length!==(script===CONFIRM?1:2))throw Error('Unsupported fixture storage script');
  const key=keys[0],value=current(key);
  if(script===CONFIRM)return value===args[0]?1:0;
  if((value??'')!==args[0])return 0;
  rows.set(key,args[1]);if(script===EXPIRING)ttl.set(key,clock()+86400000);else ttl.delete(key);return 1;
 }};
}
module.exports={create};
