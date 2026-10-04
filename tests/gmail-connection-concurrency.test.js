const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync('lib/gmail.js','utf8');
function fixture(){
  let record=null,providerResolve,providerStartedResolve;
  const started=new Promise(ok=>{providerStartedResolve=ok});
  const provider=new Promise(ok=>{providerResolve=ok});
  const clone=value=>value==null?null:JSON.parse(JSON.stringify(value));
  const kv={get:async()=>clone(record),eval:async(script,keys,args)=>{
    if(script.includes('__CALLERCORE_DELETE__')){
      if((record==null?'':JSON.stringify(record))!==args[1])return 0;
      record=null;return 1;
    }
    if((record==null?'':JSON.stringify(record))!==args[0])return 0;
    record=JSON.parse(args[1]);return 1;
  }};
  const ctx=vm.createContext({require:name=>name==='./kv'?{kv}:name==='./config-transaction'?require('../lib/config-transaction'):require(name),
    module:{exports:{}},process:{env:{CALLERCORE_ENCRYPTION_KEY:'test-key-with-at-least-thirty-two-characters'}},Buffer,URL,URLSearchParams,Date,
    fetch:async()=>{providerStartedResolve();return provider},setTimeout,crypto});
  vm.runInContext(source,ctx);
  return {api:ctx.module.exports,ctx,kv,started,resolve:()=>providerResolve({ok:true,json:async()=>({access_token:'fresh',expires_in:3600})}),get:()=>clone(record),set:value=>{record=clone(value)}};
}
test('provider token refresh cannot resurrect a disconnected Gmail connection',async()=>{
  const f=fixture();await f.api.saveConnection('admin@test.example',{refresh_token:'refresh'}, {email:'gmail@test.example'});
  const pending=vm.runInContext("accessToken('admin@test.example')",f.ctx);
  await f.started;await f.api.disconnect('admin@test.example');f.resolve();
  await assert.rejects(pending,/connection changed/);assert.equal(f.get(),null);
});
test('provider token refresh cannot overwrite a newer Gmail connection',async()=>{
  const f=fixture();await f.api.saveConnection('admin@test.example',{refresh_token:'refresh'}, {email:'old@test.example'});
  const pending=vm.runInContext("accessToken('admin@test.example')",f.ctx);await f.started;
  await f.api.saveConnection('admin@test.example',{refresh_token:'new-refresh'}, {email:'new@test.example'});
  const newer=f.get();f.resolve();await assert.rejects(pending,/connection changed/);assert.deepEqual(f.get(),newer);
});
test('disconnect refuses a replacement connection written after its initial read',async()=>{
  const f=fixture();await f.api.saveConnection('admin@test.example',{refresh_token:'refresh'}, {email:'old@test.example'});
  const originalGet=f.kv.get;let changed=false;
  f.kv.get=async()=>{const before=await originalGet();if(!changed){changed=true;f.set({...before,gmailEmail:'new@test.example'})}return before};
  await assert.rejects(f.api.disconnect('admin@test.example'),/changed during disconnect/);
  assert.equal(f.get().gmailEmail,'new@test.example');
});

test('stale displayed Gmail account cannot disconnect a replacement account',async()=>{
  const f=fixture();await f.api.saveConnection('admin@test.example',{refresh_token:'refresh'},{email:'new@test.example'});
  const before=f.get();await assert.rejects(f.api.disconnect('admin@test.example','old@test.example'),error=>error.code==='GMAIL_CONNECTION_CHANGED');
  assert.deepEqual(f.get(),before);
  await f.api.disconnect('admin@test.example','NEW@test.example');assert.equal(f.get(),null);
});

test('OAuth for a different Gmail account cannot inherit the previous account refresh token',async()=>{
  const f=fixture();await f.api.saveConnection('admin@test.example',{refresh_token:'refresh'},{email:'old@test.example'});
  const before=f.get();await assert.rejects(f.api.saveConnection('admin@test.example',{access_token:'new'},{email:'new@test.example'}),/did not return a refresh token/);
  assert.deepEqual(f.get(),before);
  await f.api.saveConnection('admin@test.example',{access_token:'same-account'},{email:'OLD@test.example'});
  assert.equal(f.get().gmailEmail,'old@test.example');
});

test('disconnect endpoint requires displayed account identity and reports concurrent change as conflict',async()=>{
  const account=fs.readFileSync('api/account.js','utf8'),start=account.indexOf('async function adminGmailDisconnect('),end=account.indexOf('\nasync function adminGmailInbox(',start);
  const calls=[],ctx=vm.createContext({requireAdmin:async()=>({email:'admin@test.example'}),cleanEmail:value=>String(value).trim().toLowerCase(),
    disconnectGmail:async(...args)=>{calls.push(args);const error=new Error('Changed account');error.code='GMAIL_CONNECTION_CHANGED';throw error},console,safeError:value=>value.message});
  vm.runInContext(account.slice(start,end),ctx);
  const response=()=>({code:0,body:null,status(value){this.code=value;return this},json(value){this.body=value;return this}});
  let res=response();await ctx.adminGmailDisconnect({body:{}},res);assert.equal(res.code,409);assert.equal(calls.length,0);
  res=response();await ctx.adminGmailDisconnect({body:{expectedGmailEmail:'Shown@Test.Example'}},res);assert.equal(res.code,409);
  assert.deepEqual(Array.from(calls[0]),['admin@test.example','shown@test.example']);assert.match(res.body.error,/Changed account/);
});

test('thread cache keys isolate Gmail accounts even when provider thread identifiers match',()=>{
  const f=fixture(),first=vm.runInContext("threadCacheKey('Admin@test.example','same-thread','one@test.example')",f.ctx),second=vm.runInContext("threadCacheKey('admin@test.example','same-thread','two@test.example')",f.ctx);
  assert.notEqual(first,second);assert.match(first,/^gmail:thread:v2:/);
  assert.equal(first,vm.runInContext("threadCacheKey('admin@test.example','same-thread','ONE@test.example')",f.ctx));
});

test('expected account mismatch rejects token access before contacting the provider',async()=>{
  const f=fixture();await f.api.saveConnection('admin@test.example',{refresh_token:'refresh'},{email:'new@test.example'});
  let contacted=false;f.ctx.fetch=async()=>{contacted=true;throw Error('Unexpected provider call')};
  await assert.rejects(vm.runInContext("accessToken('admin@test.example','old@test.example')",f.ctx),/account changed/);
  assert.equal(contacted,false);
});

test('read-state and send mutations reject a stale displayed account before provider contact',async()=>{
  const f=fixture();await f.api.saveConnection('admin@test.example',{refresh_token:'refresh'},{email:'new@test.example'});
  let contacted=false;f.ctx.fetch=async()=>{contacted=true;throw Error('Unexpected provider request')};
  await assert.rejects(f.api.markThreadRead('admin@test.example','thread','old@test.example'),error=>error.code==='GMAIL_CONNECTION_CHANGED');
  await assert.rejects(f.api.sendMessage('admin@test.example',{to:'customer@test.example',subject:'Draft',body:'Draft',expectedGmailEmail:'old@test.example'}),error=>error.code==='GMAIL_CONNECTION_CHANGED');
  assert.equal(contacted,false);
});

test('From-address validation rejects changed account before loading aliases',async()=>{
  const account=fs.readFileSync('api/account.js','utf8'),start=account.indexOf('async function validatedGmailFrom('),end=account.indexOf('\nfunction validGmailAliases(',start);
  const ctx=vm.createContext({getGmailConnection:async()=>({gmailEmail:'new@test.example',refreshTokenEnc:'encrypted'}),cleanEmail:value=>String(value||'').trim().toLowerCase(),listGmailAliases:async()=>assert.fail('Stale mailbox must not load sender aliases')});
  vm.runInContext(account.slice(start,end),ctx);
  await assert.rejects(ctx.validatedGmailFrom('admin@test.example','alias@test.example','old@test.example'),error=>error.code==='GMAIL_CONNECTION_CHANGED');
});

test('account switch during sender-alias loading rejects send authorization',async()=>{
  const account=fs.readFileSync('api/account.js','utf8'),start=account.indexOf('async function validatedGmailFrom('),end=account.indexOf('\nfunction validGmailAliases(',start);let reads=0;
  const ctx=vm.createContext({getGmailConnection:async()=>({gmailEmail:++reads===1?'old@test.example':'new@test.example',refreshTokenEnc:'encrypted'}),cleanEmail:value=>String(value||'').trim().toLowerCase(),listGmailAliases:async()=>[{email:'old@test.example',isPrimary:true}]});
  vm.runInContext(account.slice(start,end),ctx);
  await assert.rejects(ctx.validatedGmailFrom('admin@test.example','','old@test.example'),error=>error.code==='GMAIL_CONNECTION_CHANGED');
});

test('read and send endpoints reject missing displayed identity without invoking provider mutations',async()=>{
  const account=fs.readFileSync('api/account.js','utf8'),start=account.indexOf('async function adminGmailRead('),end=account.indexOf('\nasync function adminWebsiteConversation(',start);
  const ctx=vm.createContext({requireAdmin:async()=>({email:'admin@test.example'}),cleanEmail:value=>String(value||'').trim().toLowerCase(),
    markGmailThreadRead:async()=>assert.fail('Missing identity must not mark a thread'),validatedGmailFrom:async()=>assert.fail('Missing identity must not resolve a sender'),sendGmailMessage:async()=>assert.fail('Missing identity must not send'),console,safeError:()=>''});
  vm.runInContext(account.slice(start,end),ctx);
  for(const action of ['adminGmailRead','adminGmailSend']){
    const res={code:0,status(value){this.code=value;return this},json(value){this.body=value;return this}};
    await ctx[action]({body:{threadId:'thread',to:'customer@test.example',subject:'Draft',body:'Draft'}},res);
    assert.equal(res.code,409);assert.match(res.body.error,/connected Gmail account/);
  }
});
