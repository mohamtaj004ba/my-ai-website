'use strict';
// Explicit CI-only disposable localhost Redis. No application credentials or active DB.
const {test}=require('node:test'),assert=require('node:assert/strict'),net=require('node:net');
const {randomUUID}=require('node:crypto');
const {createStore,redisAdapter}=require('../lib/agent-operations-store');
const {runStage,mockAdapter}=require('../lib/agent-operations-worker');
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
test('real Redis Lua serializes creation, claims, budgets and a persisted manager/specialist/reviewer workflow',async()=>{
  const prefix='test:agentops:'+randomUUID()+':';
  const kv={get:key=>command(['GET',prefix+key]),eval:(script,keys,args)=>command(['EVAL',script,keys.length,...keys.map(k=>prefix+k),...args])};
  const scope={origin:'https://fixture.vercel.app',commit:'a'.repeat(40)};
  const store=()=>createStore(redisAdapter(kv),{scope});
  const input={principal:'fixture-admin',idempotencyKey:'redis_request',objective:'Synthetic inspection'};
  const [a,b]=await Promise.all([store().create(input),store().create(input)]);assert.equal(a.id,b.id);
  const claims=await Promise.allSettled([store().command(a.id,{type:'claim'}),store().command(a.id,{type:'claim'})]);assert.equal(claims.filter(x=>x.status==='fulfilled').length,1);
  // Complete claimed chief through an explicit receipt, then use new worker/store instances.
  const t=(await store().read()).tasks[0];await store().command(t.id,{type:'reserve',fence:t.fence,executionId:'exec_chief'});
  await store().command(t.id,{type:'finish',fence:t.fence,executionId:'exec_chief',actualMicros:0,result:{stage:'chief',delegate:'website-visual-qa'}});
  for(let i=0;i<3;i++)await runStage(store(),mockAdapter(),{taskId:a.id});
  const final=(await store().read()).tasks[0];assert.equal(final.status,'verified');assert.equal(final.calls,4);assert.notEqual(final.results.inspect.executionId,final.results.review.executionId);
  for(let i=0;i<2;i++){
    const j=await store().create({...input,idempotencyKey:'extra_task_'+i}),c=await store().command(j.id,{type:'claim'});
    await store().command(j.id,{type:'reserve',fence:c.fence,executionId:'exec_extra_'+i});await store().command(j.id,{type:'fail',fence:c.fence});
  }
  const over=await store().create({...input,idempotencyKey:'over_budget'}),c=await store().command(over.id,{type:'claim'});
  await assert.rejects(store().command(over.id,{type:'reserve',fence:c.fence,executionId:'exec_over'}),/budget/);
  assert.equal((await store().read()).reservations.length,6);
  // No deletes/FLUSH commands; the CI container is disposed by the runner.
});
