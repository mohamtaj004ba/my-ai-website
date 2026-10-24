'use strict';
// No credentials. Node permissions deny filesystem writes/subprocesses. Fixed IPC transport only.
// Explicit API guards are defense in depth, not an operating-system network sandbox.
const deny=()=>{throw Error('Direct network forbidden in verification worker');};
globalThis.fetch=async()=>deny();for(const name of ['node:http','node:https']){const api=require(name);api.request=deny;api.get=deny;}const net=require('node:net');net.connect=deny;net.createConnection=deny;net.Socket.prototype.connect=deny;require('node:tls').connect=deny;
const pending=new Map();let next=0,started=false;
process.on('message',async message=>{
 if(message.reply){const p=pending.get(message.reply);if(p){pending.delete(message.reply);message.error?p.reject(Error('Verification broker transport denied')):p.resolve({ok:message.status>=200&&message.status<300,status:message.status,json:async()=>message.body});}return;}
 if(started||message.type!=='start')return;started=true;
 const brokerFetch=(url,options)=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});process.send({request:id,url,body:options.body});});
 try{const result=await require('../lib/agent-operations-remote-worker').runWorker({runtime:message.runtime,approval:message.approval,headers:{Authorization:'Bearer verification-ipc-no-secret'},brokerFetch,env:{}});process.send({done:true,result});}
 catch(error){process.send({done:true,errorType:error.name,error:'Restricted verification worker stopped'});}
});
