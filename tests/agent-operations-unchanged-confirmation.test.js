'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {redisAdapter,CAS,CONFIRM,KEY}=require('../lib/agent-operations-store');
function fixture(initial){let value=initial,writes=0;const calls=[];return{adapter:redisAdapter({get:async()=>value,eval:async(script,keys,args)=>{calls.push({script,keys,args});a.deepEqual(keys,[KEY]);if(script===CONFIRM){a.equal(args.length,1);return value===args[0]?1:0;}a.equal(script,CAS);a.equal(args.length,2);if((value??'')!==args[0])return 0;value=args[1];writes++;return 1;}}),calls,value:()=>value,writes:()=>writes,set:v=>{value=v;}};}
test('unchanged existing ledger uses one exact argument and no write',async()=>{
 const raw=JSON.stringify({revision:9,history:['quoted " value','日本語'],grants:[{revoked:true}]}),f=fixture(raw);
 a.equal(await f.adapter.compare(raw,raw),true);a.equal(f.value(),raw);a.equal(f.writes(),0);a.deepEqual(f.calls,[{script:CONFIRM,keys:[KEY],args:[raw]}]);a(!CONFIRM.includes('SET'));a(!CONFIRM.includes('sha1'));
});
for(const value of [null,'',undefined,'{"revision":10}',' {"revision":9}'])test('missing, changed or differently serialized current value cannot confirm old snapshot: '+String(value),async()=>{
 const raw='{"revision":9}',f=fixture(value);a.equal(await f.adapter.compare(raw,raw),false);a.equal(f.writes(),0);a.equal(f.value(),value);
});
test('revocation after read cannot be hidden by a no-op compare',async()=>{
 const initial='{"revision":9,"revoked":false}',revoked='{"revision":10,"revoked":true}',f=fixture(initial),old=await f.adapter.read();f.set(revoked);
 a.equal(await f.adapter.compare(old,old),false);a.equal(f.value(),revoked);a.equal(f.writes(),0);
});
test('actual write and conflict preserve original exact two-value CAS semantics',async()=>{
 const f=fixture('old');a.equal(await f.adapter.compare('old','new'),true);a.equal(f.writes(),1);a.equal(f.calls[0].script,CAS);a.equal(await f.adapter.compare('old','different'),false);a.equal(f.value(),'new');
});
for(const before of [null,''])test('empty and absent initialization retain legacy write behavior: '+String(before),async()=>{
 const f=fixture(null);a.equal(await f.adapter.compare(before,''),true);a.equal(f.calls[0].script,CAS);a.equal(f.writes(),1);
});
test('uncertain provider response and thrown request fail without an adapter retry',async()=>{
 for(const result of [2,-1,'unconfirmed',{}]){let calls=0;const f=redisAdapter({eval:async()=>{calls++;return result;}});await a.rejects(f.compare('old','old'),/Uncertain storage result/);a.equal(calls,1);}
 let calls=0;const f=redisAdapter({eval:async()=>{calls++;throw Error('synthetic unavailable');}});await a.rejects(f.compare('old','old'),/synthetic unavailable/);a.equal(calls,1);
});
test('large escaped synthetic history is sent once; write estimate stays separately available',async()=>{
 const state={operations:{audit:[]},history:'\\"日本語'.repeat(100000)},raw=JSON.stringify(state),f=fixture(raw);await f.adapter.compare(raw,raw);
 const bytes=Buffer.byteLength(JSON.stringify(['eval',CONFIRM,1,KEY,raw])),writeBytes=Buffer.byteLength(JSON.stringify(['eval',CAS,1,KEY,raw,raw]));
 a(bytes/writeBytes<0.501);a.equal(f.calls[0].args.length,1);a.equal(f.writes(),0);
 const report=require('../lib/agent-operations-capacity').requestEstimate(state);a.equal(report.serializedUnchangedConfirmationBytes,bytes);a.equal(report.serializedCurrentValueCasBytes,writeBytes);a.equal(report.accountSpecificVerified,false);a.equal(report.executionAuthorized,false);
});
