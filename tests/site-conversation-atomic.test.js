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
    assert.deepEqual(keys,['site:conversation:lead-1','site:conversation:meta:lead-1']);
    const message=JSON.parse(args[0]);
    assert.ok(Number(args[1])>0);
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
  for(const [result,pattern] of [[-1,/malformed/],[-3,/coverage metadata is malformed/],[-2,/could not be confirmed/],[0,/could not be confirmed/],[201,/could not be confirmed/]]){
    const f=fixture({result});
    await assert.rejects(()=>appendSiteConversation(f.kv,'lead-1',message('one')),pattern);
  }
  await assert.rejects(()=>appendSiteConversation({eval:async()=>{throw Error('provider error')}},'lead-1',message('one')),/provider error/);
});

test('website inbox read refuses corrupt history instead of pretending the thread is empty',()=>{
  const account=fs.readFileSync('api/account.js','utf8');
  const start=account.indexOf('async function adminWebsiteConversation(');
  const end=account.indexOf('async function adminWebsiteReply(',start);
  assert.ok(start>=0&&end>start);
  const read=account.slice(start,end);
  assert.match(read,/rawMessages!=null&&\(!Array\.isArray\(rawMessages\)\|\|rawMessages\.some/);
  assert.match(read,/status\(503\)/);
  assert.doesNotMatch(read,/Array\.isArray\(messages\)\?messages:\[\]/);
});

test('website conversation append stores explicit retained-history coverage atomically',()=>{
  assert.match(SITE_CONVERSATION_APPEND,/KEYS\[2\]/);
  assert.match(SITE_CONVERSATION_APPEND,/totalMessages=total/);
  assert.match(SITE_CONVERSATION_APPEND,/truncated=total>#history/);
  assert.match(SITE_CONVERSATION_APPEND,/baselineVerified=baselineVerified/);
});
test('admin website conversation returns explicit legacy or retained-history coverage',()=>{
  const account=fs.readFileSync('api/account.js','utf8');
  const start=account.indexOf('async function adminWebsiteConversation('),end=account.indexOf('async function adminWebsiteReply(',start),read=account.slice(start,end);
  assert.match(read,/site:conversation:meta:/);
  assert.match(read,/legacyBoundary:retainedMessages>=200/);
  assert.match(read,/baselineVerified!==false/);
});
test('admin Inbox shows website-thread retention warning instead of implying all 200 retained messages are complete history',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8'),html=fs.readFileSync('admin-dashboard.html','utf8');
  assert.match(html,/id="inboxThreadCoverage"[^>]*role="status"/);
  assert.match(ui,/History limit: showing the most recent/);
  assert.match(ui,/Full website-thread history cannot be verified/);
});

test('atomic website conversation append validates retained rows and incoming message fields',async()=>{
  assert.match(SITE_CONVERSATION_APPEND,/type\(row\.id\)~='string'/);
  assert.match(SITE_CONVERSATION_APPEND,/type\(row\.direction\)~='string'/);
  assert.match(SITE_CONVERSATION_APPEND,/type\(row\.body\)~='string'/);
  assert.match(SITE_CONVERSATION_APPEND,/retained~=#history/);
  for(const bad of [
    {id:'',direction:'inbound',body:'x'},
    {id:'m1',direction:'',body:'x'},
    {id:'m1',direction:'inbound',body:42},
    {id:'m1',direction:'inbound',body:''}
  ])await assert.rejects(()=>appendSiteConversation(fixture().kv,'lead-1',bad),/Valid inquiry required/);
});
