const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {appendSiteConversation,SITE_CONVERSATION_APPEND}=require('../lib/site-conversation');
const contact=fs.readFileSync('api/contact.js','utf8');

function fixture({history=[],result}={}){
  let stored=history.slice(),calls=0;
  const kv={eval:async(script,keys,args)=>{
    calls++;
    assert.equal(script,SITE_CONVERSATION_APPEND);
    assert.deepEqual(keys,['site:conversation:lead-1']);
    const message=JSON.parse(args[0]);
    if(result!==undefined)return result;
    stored=[...stored,message].slice(-200);
    return stored.length;
  }};
  return {kv,read:()=>stored,calls:()=>calls};
}
const message=id=>({id,direction:'inbound',body:'Message '+id});
test('website contact path appends rather than reading and replacing conversation history',()=>{
  assert.match(contact,/appendSiteConversation\(kv,prospect\.id,/);
  assert.doesNotMatch(contact,/kv\.set\(convKey/);
  assert.ok(SITE_CONVERSATION_APPEND.indexOf("redis.call('SET'")>SITE_CONVERSATION_APPEND.indexOf('while #history>200'));
  assert.match(SITE_CONVERSATION_APPEND,/pcall\(cjson\.decode,raw\)/);
  assert.match(SITE_CONVERSATION_APPEND,/return -1/);
});
test('concurrent inquiries retain both messages and cap the stored history',async()=>{
  const f=fixture({history:Array.from({length:199},(_,i)=>message('old-'+i))});
  await Promise.all([appendSiteConversation(f.kv,'lead-1',message('one')),appendSiteConversation(f.kv,'lead-1',message('two'))]);
  assert.equal(f.calls(),2);assert.equal(f.read().length,200);
  assert.equal(f.read().at(-2).id,'one');assert.equal(f.read().at(-1).id,'two');
  assert.equal(f.read()[0].id,'old-1');
});
test('malformed history and ambiguous storage failure are never called a success',async()=>{
  for(const [result,pattern] of [[-1,/malformed/],[-2,/could not be confirmed/],[0,/could not be confirmed/],[201,/could not be confirmed/]]){
    const f=fixture({result});
    await assert.rejects(()=>appendSiteConversation(f.kv,'lead-1',message('one')),pattern);
  }
  await assert.rejects(()=>appendSiteConversation({eval:async()=>{throw Error('provider error')}},'lead-1',message('one')),/provider error/);
});
