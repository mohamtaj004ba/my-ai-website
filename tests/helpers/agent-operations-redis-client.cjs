'use strict';
const net=require('node:net');
function command(parts){return new Promise((resolve,reject)=>{
  const socket=net.createConnection({host:'127.0.0.1',port:6379});let bytes=Buffer.alloc(0),done=false;
  const finish=(err,value)=>{if(done)return;done=true;socket.destroy();err?reject(err):resolve(value);};
  socket.setTimeout(5000,()=>finish(new Error('Disposable Redis timeout')));socket.on('error',e=>finish(e));
  socket.on('connect',()=>socket.write(Buffer.concat([Buffer.from('*'+parts.length+'\r\n'),...parts.flatMap(p=>{const b=Buffer.from(String(p));return [Buffer.from('$'+b.length+'\r\n'),b,Buffer.from('\r\n')];})])));
  socket.on('data',chunk=>{
    bytes=Buffer.concat([bytes,chunk]);const i=bytes.indexOf('\r\n');if(i<0)return;const type=String.fromCharCode(bytes[0]),head=bytes.subarray(1,i).toString();
    if(type==='-')return finish(new Error('Redis command rejected'));
    if(type===':')return finish(null,Number(head));
    if(type==='+')return finish(null,head);
    if(type==='$'){const len=Number(head);if(len===-1)return finish(null,null);if(bytes.length>=i+2+len+2)return finish(null,bytes.subarray(i+2,i+2+len).toString());}
  });
});}
module.exports={command};
