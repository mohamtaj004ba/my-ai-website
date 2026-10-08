const test=require('node:test');
const assert=require('node:assert/strict');
const {prependAuditEvent,AUDIT_PREPEND}=require('../lib/audit-log');

test('audit helper prepends through one Redis operation and enforces its history limit',async()=>{
  const events=[];let calls=0;
  const kv={eval:async(script,keys,args)=>{calls++;assert.equal(script,AUDIT_PREPEND);assert.deepEqual(keys,['audit:tenant']);events.unshift(JSON.parse(args[0]));events.splice(Number(args[1]));return events.length}};
  await Promise.all(Array.from({length:250},(_,i)=>prependAuditEvent(kv,'audit:tenant',{id:String(i)},200)));
  assert.equal(calls,250);assert.equal(events.length,200);assert.equal(new Set(events.map(x=>x.id)).size,200);
});

test('audit helper rejects malformed stored history instead of silently replacing it',async()=>{
  await assert.rejects(()=>prependAuditEvent({eval:async()=>-1},'audit:tenant',{id:'x'}),/malformed/);
});
