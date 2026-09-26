const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

function authHarness(){
  const data=new Map();
  const kv={
    async get(key){return data.get(key)||null},
    async set(key,value){data.set(key,value)},
    async del(key){data.delete(key)}
  };
  const source=fs.readFileSync(path.join(__dirname,'..','lib','auth.js'),'utf8');
  const mod={exports:{}};
  vm.runInNewContext(source,{module:mod,exports:mod.exports,require(name){
    if(name==='crypto')return crypto;
    if(name==='./kv')return {kv};
    throw Error('Unexpected import '+name);
  },process:{env:{NODE_ENV:'production'}},Buffer},{filename:'lib/auth.js'});
  return {auth:mod.exports,kv,data};
}
function response(){
  const headers={};return {headers,setHeader(key,value){headers[key]=value}};
}
function cookieRequest(cookie){return {headers:{cookie}}}

test('new session IDs remain only in HttpOnly cookie and hashed KV key',async()=>{
  const {auth,kv,data}=authHarness(),res=response();
  await kv.set('user:email:owner@example.test',{workspaceId:'ws1',sessionVersion:2});
  const token=await auth.createSession(res,{email:'owner@example.test',workspaceId:'ws1',authVersion:2});
  assert.equal(data.has('session:'+token),false);
  assert.ok(data.has(auth.sessionKey(token)));
  assert.match(res.headers['Set-Cookie'],/HttpOnly/);
  assert.match(res.headers['Set-Cookie'],/SameSite=Lax/);
  assert.match(res.headers['Set-Cookie'],/Secure/);
  assert.equal((await auth.getSession(cookieRequest('cc_session='+token))).workspaceId,'ws1');
});
test('disabled and reassigned members cannot reuse valid session cookies',async()=>{
  const {auth,kv}=authHarness(),res=response(),email='owner@example.test';
  await kv.set('user:email:'+email,{workspaceId:'ws1',sessionVersion:1});
  const token=await auth.createSession(res,{email,workspaceId:'ws1',authVersion:1});
  const req=cookieRequest('cc_session='+token);
  assert.ok(await auth.getSession(req));
  await kv.set('user:email:'+email,{workspaceId:'ws1',sessionVersion:1,disabled:true});
  assert.equal(await auth.getSession(req),null);
  await kv.set('user:email:'+email,{workspaceId:'ws2',sessionVersion:1});
  assert.equal(await auth.getSession(req),null);
  await kv.set('user:email:'+email,{workspaceId:'ws1',sessionVersion:2});
  assert.equal(await auth.getSession(req),null);
});
test('read-only admin client view requires the current admin home and session version',async()=>{
  const {auth,kv}=authHarness(),email='admin@example.test';
  await kv.set('user:email:'+email,{workspaceId:'admin-home',role:'admin',sessionVersion:3});
  const res=response();
  const token=await auth.createSession(res,{email,workspaceId:'client1',adminView:true,adminHomeWorkspaceId:'admin-home',role:'admin',authVersion:3});
  const req=cookieRequest('cc_session='+token);
  assert.ok((await auth.getSession(req)).adminView);
  await kv.set('user:email:'+email,{workspaceId:'different-home',role:'admin',sessionVersion:3});
  assert.equal(await auth.getSession(req),null);
});
test('legacy raw session is readable only until it is destroyed',async()=>{
  const {auth,kv,data}=authHarness(),token='legacy-session',email='legacy@example.test';
  await kv.set('user:email:'+email,{workspaceId:'legacy',sessionVersion:0});
  await kv.set('session:'+token,{email,workspaceId:'legacy',authVersion:0});
  const req=cookieRequest('cc_session='+token);
  assert.ok(await auth.getSession(req));
  await auth.destroySessionToken(token);
  assert.equal(data.has('session:'+token),false);
  assert.equal(await auth.getSession(req),null);
});
test('finance and AI explicitly distinguish estimates from recorded financial history',()=>{
  const api=fs.readFileSync(path.join(__dirname,'..','api','account.js'),'utf8');
  const dashboard=fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8');
  assert.match(api,/monthlyExposureIsUnpaidInvoiceBalance:false/);
  assert.match(api,/source:'preview_reconstruction'/);
  assert.match(api,/server_workspace_subscription_status_and_recorded_expenses/);
  assert.match(api,/Never infer verified past performance or month-over-month growth/);
  assert.match(dashboard,/Preview estimate: earlier months are reconstructed/);
  assert.match(dashboard,/verifiedHistory=history.filter\(x=>x.source!=='preview_reconstruction'\)/);
});

test('malformed cookie encoding is ignored instead of crashing the auth handler',async()=>{
  const {auth}=authHarness();
  assert.equal(await auth.getSession(cookieRequest('cc_session=%ZZ')),null);
  assert.equal(await auth.getSession(cookieRequest('not_session=%E0%A4%A; cc_session=%GG')),null);
});
test('server verified finance is placed before a potentially truncated browser snapshot',()=>{
  const api=fs.readFileSync(path.join(__dirname,'..','api','account.js'),'utf8');
  const start=api.indexOf('async function adminAiGuide');
  const end=api.indexOf('const LAUNCH_GATE_DEFS',start);
  assert.ok(start>=0&&end>start);
  const content=api.slice(start,end);
  assert.match(content,/const snapshot=\{\s*financialGroundTruth:verifiedFinance/);
  assert.match(content,/delete uiSnapshot\.financialGroundTruth/);
  assert.match(content,/delete uiSnapshot\.finance/);
});

test('checkout preserves owner session revocation data and cannot repurpose an admin identity',()=>{
  const checkout=fs.readFileSync(path.join(__dirname,'..','api','create-checkout-session.js'),'utf8');
  const webhook=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');
  assert.match(checkout,/existingMember\?\.role==='admin'/);
  assert.match(webhook,/existingMember\?\.role==='admin'\|\|existingMember\?\.disabled/);
  assert.match(webhook,/\{\.\.\.\(existingMember\|\|\{\}\),workspaceId,role:existingMember\?\.role\|\|'owner',email\}/);
});
test('client calendar launch gate follows server capability rather than a static disabled flag',()=>{
  const dashboard=fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8');
  assert.match(dashboard,/function featureDeferred\(feature\)/);
  assert.match(dashboard,/feature==='appointments'\?!capability\('calendar'\)/);
  assert.match(dashboard,/PLAN_DATA\.Growth\.features\.appointments=true/);
  assert.match(dashboard,/PLAN_DATA\.Pro\.features\.appointments=true/);
});
