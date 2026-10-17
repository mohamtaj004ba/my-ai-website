const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync('api/account.js','utf8');
const helpers=source.slice(source.indexOf('function validGmailConnection('),source.indexOf('async function adminGmailStatus('));
const feeds=source.slice(source.indexOf('async function adminGmailInbox('),source.indexOf('async function adminGmailRead('));
function fixture({connected=true,invalid=false}={}){
  const admin='admin@test.example',email='new@test.example',reads=[],writes=[],legacyHash=crypto.createHash('sha256').update(admin).digest('hex');
  const legacy=new Map([['gmail:inbox:'+legacyHash,{threads:[{id:'old-thread',messages:[]}],analytics:{},coverage:{verified:true},syncedAt:Date.now()}],['gmail:aliases:'+legacyHash,{aliases:[{email:'old@test.example'}],cachedAt:Date.now()}]]);
  let connection=connected?{adminEmail:admin,gmailEmail:invalid?'':email,refreshTokenEnc:'encrypted'}:null,code,body;
  const ctx=vm.createContext({requireAdmin:async()=>({email:admin}),getGmailConnection:async()=>connection,gmailConfigReady:()=>true,
    cleanEmail:value=>String(value||'').trim().toLowerCase(),crypto,Date,Number,String,Array,Math,Promise,console:{error(){}},safeError:()=>'',
    kv:{get:async key=>{reads.push(key);return legacy.get(key)||null},set:async(key,value)=>{writes.push({key,value})}},
    listGmailInbox:async()=>({gmailEmail:email,connected:true,threads:[],analytics:{},coverage:{verified:true}}),listGmailAliases:async()=>[{email,isPrimary:true}],emailKey:value=>value});
  vm.runInContext(helpers+feeds,ctx);
  const run=async(action,cached=true)=>{code=0;body=null;await ctx[action]({query:cached?{cached:'1'}:{}},{status(value){code=value;return this},json(value){body=value;return this}});return {code,body}};
  return {ctx,reads,writes,run,change:value=>{connection=value},scope:crypto.createHash('sha256').update(JSON.stringify([admin,email])).digest('hex')};
}
test('new Gmail account does not read legacy inbox or alias caches from a previous account',async()=>{
  const f=fixture();let r=await f.run('adminGmailInbox');assert.equal(r.code,200);assert.equal(r.body.emptyCache,true);assert.equal(r.body.threads.length,0);
  r=await f.run('adminGmailAliases');assert.equal(r.code,200);assert.equal(r.body.aliases.length,0);
  assert.deepEqual(f.reads,['gmail:inbox:v2:'+f.scope,'gmail:aliases:v2:'+f.scope]);
});
test('inbox and aliases write only the connected account cache namespace',async()=>{
  const f=fixture();assert.equal((await f.run('adminGmailInbox',false)).code,200);assert.equal((await f.run('adminGmailAliases',false)).code,200);
  assert.deepEqual(f.writes.map(x=>x.key),['gmail:inbox:v2:'+f.scope,'gmail:summary:v2:'+f.scope,'gmail:aliases:v2:'+f.scope]);
});
test('disconnected and unverifiable Gmail account identities never read cached inbox data',async()=>{
  for(const opts of [{connected:false},{invalid:true}]){
    const f=fixture(opts),r=await f.run('adminGmailInbox');assert.equal(r.code,opts.invalid?503:200);assert.equal(f.reads.length,0);assert.equal(f.writes.length,0);
  }
});
test('provider response from a different Gmail account and changed alias connection cannot populate the reviewed account cache',async()=>{
  const f=fixture();f.ctx.listGmailInbox=async()=>({gmailEmail:'other@test.example',threads:[],analytics:{},coverage:{verified:true}});
  assert.equal((await f.run('adminGmailInbox',false)).code,502);assert.equal(f.writes.length,0);
  f.ctx.listGmailAliases=async()=>{f.change({gmailEmail:'other@test.example'});return [{email:'other@test.example',isPrimary:true}]};
  assert.equal((await f.run('adminGmailAliases',false)).code,502);assert.equal(f.writes.length,0);
});
test('contradictory cached sender aliases cannot appear as verified or become stale provider fallbacks',async()=>{
  for(const aliases of [[{email:'other@test.example',isPrimary:true}],[{email:'new@test.example',isPrimary:'true'}],[{email:'new@test.example',isPrimary:true,inboundSeen:'false'}],[{email:'new@test.example',isPrimary:true},{email:'NEW@test.example',verificationStatus:'accepted'}]]){
    const f=fixture();f.ctx.kv.get=async()=>({aliases,cachedAt:Date.now()});f.ctx.listGmailAliases=async()=>{throw Error('Provider unavailable')};
    const cached=await f.run('adminGmailAliases');assert.equal(cached.code,503);assert.equal(cached.body.aliases,undefined);
    const live=await f.run('adminGmailAliases',false);assert.equal(live.code,502);assert.equal(live.body.aliases,undefined);assert.equal(f.writes.length,0);
  }
});
