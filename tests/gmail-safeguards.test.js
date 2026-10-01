const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'lib','gmail.js'),'utf8');
const account=fs.readFileSync(path.join(root,'api','account.js'),'utf8');

test('Gmail API retries quota and concurrency responses with bounded exponential backoff',()=>{
  assert.match(src,/for\(let attempt=0;attempt<3;attempt\+\+\)/);
  assert.match(src,/r\.status===429/);
  assert.match(src,/r\.status===403&&\/quota\|rate\|concurrent\/i\.test\(message\)/);
  assert.match(src,/800\*Math\.pow\(2,attempt\)/);
  assert.match(src,/Math\.min\(delay,5000\)/);
});

test('Inbox thread hydration is sequential to avoid Gmail concurrent-request limits',()=>{
  assert.match(src,/for\(let i=0;i<refs\.length;i\+\+\)/);
  assert.match(src,/threads\.push\(await loadThread\(refs\[i\]\)\)/);
  assert.match(src,/setTimeout\(r,180\)/);
  assert.doesNotMatch(src,/Promise\.all\(refs\.slice/);
});

test('Gmail token encryption requires a strong environment key',()=>{
  assert.match(src,/CALLERCORE_ENCRYPTION_KEY must be at least 32 characters/);
  assert.match(src,/String\(process\.env\.CALLERCORE_ENCRYPTION_KEY\|\|''\)\.length>=32/);
  assert.match(src,/aes-256-gcm/);
  assert.match(src,/randomBytes\(12\)/);
});

test('Gmail OAuth requests only the restricted modify scope needed for admin inbox operations',()=>{
  assert.match(src,/gmail\.modify/);
  assert.doesNotMatch(src,/gmail\.send/);
  assert.match(src,/integration:gmail:admin:/);
});

test('Gmail sync is quota-conscious and cache-first',()=>{
  assert.match(src,/maxResults=25/);
  assert.match(account,/Date\.now\(\)-Number\(cached\.syncedAt\|\|0\)<2\*60\*1000/);
  assert.match(account,/Math\.min\(25/);
  assert.match(account,/6\*60\*60\*1000/);
  assert.match(account,/parseGmailAliasCache\(aliasCache\)/);
  assert.match(account,/validGmailInboxPayload\(rawCached,\{cached:true\}\)/);
  assert.match(account,/warning:'Fresh Gmail sync failed'/);
  assert.match(account,/error:'Gmail sync failed'/);
});


test('Gmail cache validators reject malformed successful cache payloads instead of synthesizing empty state',()=>{
  const start=account.indexOf('function validGmailAliases('),end=account.indexOf('\nasync function adminGmailStatus(',start);
  assert.ok(start>=0&&end>start);
  const vm=require('node:vm'),ctx=vm.createContext({Array,Object,String,Number});
  vm.runInContext(account.slice(start,end),ctx);
  assert.equal(vm.runInContext("parseGmailAliasCache({broken:true}).valid",ctx),false);
  assert.equal(vm.runInContext("parseGmailAliasCache([{email:'ok@example.test'}]).valid",ctx),true);
  ctx.good={threads:[{id:'t1',messages:[]}],analytics:{unread:0},coverage:{verified:true},syncedAt:1};
  assert.equal(vm.runInContext("validGmailInboxPayload(good,{cached:true})",ctx),true);
  ctx.bad={threads:[],analytics:{},coverage:{verified:false},syncedAt:1};
  assert.equal(vm.runInContext("validGmailInboxPayload(bad,{cached:true})",ctx),false);
  ctx.bad={threads:null,analytics:{},coverage:{verified:true},syncedAt:1};
  assert.equal(vm.runInContext("validGmailInboxPayload(bad,{cached:true})",ctx),false);
});

test('Gmail handlers never use malformed caches as stale provider fallbacks',()=>{
  const aliasStart=account.indexOf('async function adminGmailAliases('),aliasEnd=account.indexOf('\nasync function adminGmailInbox(',aliasStart);
  const inboxStart=account.indexOf('async function adminGmailInbox('),inboxEnd=account.indexOf('\nasync function adminGmailAliases(',inboxStart);
  const aliasBody=account.slice(aliasStart,aliasEnd),inboxBody=account.slice(inboxStart,inboxEnd);
  assert.match(aliasBody,/parsedCache\.valid&&cachedAliases\.length/);
  assert.match(aliasBody,/Cached Gmail sender aliases are unavailable/);
  assert.match(inboxBody,/cachedValid&&cached/);
  assert.match(inboxBody,/Cached Gmail inbox is unavailable/);
});


test('Gmail inbox Growth enrichment fails closed on malformed lookup or record identity',()=>{
  const start=account.indexOf('async function adminGmailInbox('),end=account.indexOf('\nasync function adminGmailAliases(',start);
  assert.ok(start>=0&&end>start);
  const body=account.slice(start,end);
  assert.match(body,/rawPid=await kv\.get\('site:prospect:email:'\+emailKey\(sender\)\),pid=typeof rawPid==='string'\?rawPid\.trim\(\):''/);
  assert.match(body,/rawPid!=null&&!pid/);
  assert.match(body,/!p\|\|typeof p!=='object'\|\|Array\.isArray\(p\)\|\|String\(p\.id\|\|''\)!==pid/);
  assert.match(body,/linked Growth records could not be verified/);
  assert.match(body,/growthLinkWarning\?\{warning:growthLinkWarning\}/);
});

test('Admin Inbox surfaces Growth-link verification warnings even after a fresh Gmail sync',()=>{
  const ui=fs.readFileSync(path.join(root,'dashboard.js'),'utf8');
  const start=ui.indexOf('async function refreshAdminInboxLive('),end=ui.indexOf('\nfunction websiteInboxItems(',start);
  assert.ok(start>=0&&end>start);
  const body=ui.slice(start,end);
  assert.match(body,/adminInboxData\.liveError=String\(d\.warning\|\|\(d\.stale===true\?'Gmail refresh failed':''\)\)/);
  assert.match(ui,/adminInboxData\.liveError=String\(d\.warning\|\|''\)\.slice\(0,160\)/);
});
