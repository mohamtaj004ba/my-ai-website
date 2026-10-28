const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const apiSource=fs.readFileSync('api/marketing-unsubscribe.js','utf8');
const page=fs.readFileSync('unsubscribe.html','utf8');
const admin=fs.readFileSync('admin-dashboard.html','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');
const account=fs.readFileSync('api/account.js','utf8');

async function apiRequest(method,{secret='x'.repeat(64),query={},body={}}={}){
  let status=0,payload=null,inspectCalls=0,revokeCalls=0;
  const modules={
    '../lib/kv':{kv:{}},
    '../lib/safe-log':{safeError:()=> 'redacted'},
    '../lib/rate-limit':{rateLimit:async()=>({limited:false}),requestIp:()=> '127.0.0.1'},
    '../lib/prospect-unsubscribe':{
      inspectMarketingUnsubscribe:async(_kv,token)=>{inspectCalls++;assert.equal(token,'token-1');return {state:'granted',active:true,alreadyUnsubscribed:false}},
      revokeMarketingUnsubscribe:async(_kv,token)=>{revokeCalls++;assert.equal(token,'token-1');return {alreadyUnsubscribed:false}}
    }
  };
  const module={exports:{}};
  vm.runInNewContext(apiSource,{module,exports:module.exports,process:{env:{MARKETING_UNSUBSCRIBE_SECRET:secret}},console:{error(){}},
    String,Date,Number,Promise,require:name=>{if(!(name in modules))throw Error('unexpected dependency '+name);return modules[name]}});
  const req={method,query,body,headers:{}};
  const res={setHeader(){},status(n){status=n;return this},json(x){payload=x;return x}};
  await module.exports(req,res);
  return {status,payload,inspectCalls,revokeCalls};
}

test('inspection POST validates only and never invokes the revocation write path',async()=>{
  const r=await apiRequest('POST',{body:{action:'inspect',token:'token-1'}});
  assert.equal(r.status,200);
  assert.equal(r.payload.state,'granted');
  assert.equal(r.inspectCalls,1);
  assert.equal(r.revokeCalls,0);
});

test('only explicit unsubscribe action invokes the revocation write path',async()=>{
  const r=await apiRequest('POST',{body:{action:'unsubscribe',token:'token-1'}});
  assert.equal(r.status,200);
  assert.equal(r.payload.unsubscribed,true);
  assert.equal(r.inspectCalls,0);
  assert.equal(r.revokeCalls,1);
  const get=await apiRequest('GET');
  assert.equal(get.status,405);
  assert.equal(get.inspectCalls,0);
  assert.equal(get.revokeCalls,0);
});

test('unsubscribe API fails closed until its dedicated signing secret is configured',async()=>{
  const r=await apiRequest('POST',{secret:'',body:{action:'inspect',token:'token-1'}});
  assert.equal(r.status,503);
  assert.equal(r.inspectCalls,0);
  assert.equal(r.revokeCalls,0);
});

test('unsubscribe page strips bearer token from browser history and requires a button click before POST',()=>{
  assert.match(page,/meta name="robots" content="noindex,nofollow"/);
  assert.match(page,/history\.replaceState\(null,''\,'\/unsubscribe'\)/);
  assert.match(page,/id="unsubscribeButton" type="button" disabled/);
  assert.match(page,/location\.hash/);
  assert.doesNotMatch(page,/marketing-unsubscribe\?token=/);
  assert.match(page,/JSON\.stringify\(\{action:'inspect',token\}\)/);
  const click=page.indexOf("button.addEventListener('click'");
  const revoke=page.indexOf("JSON.stringify({action:'unsubscribe',token})");
  assert.ok(click>0&&revoke>click);
  assert.doesNotMatch(page,/src="\/site\.js"/);
  assert.match(page,/does not stop transactional, account, billing, security, support, or service messages/i);
});

test('Growth shows consent as read-only state and exposes no admin grant/revoke control',()=>{
  assert.match(admin,/id="prospectConsentLabel"/);
  assert.match(admin,/id="prospectConsentBadge"/);
  assert.match(admin,/Marketing consent can only come from an explicit prospect action/i);
  assert.doesNotMatch(admin,/id="prospectConsentGrant"/);
  assert.doesNotMatch(admin,/id="prospectConsentRevoke"/);
  assert.match(dashboard,/function prospectConsentUi\(/);
  assert.match(dashboard,/Email: Granted/);
  assert.match(dashboard,/Email: Unsubscribed/);
  assert.match(dashboard,/Email: Unknown/);
});

test('ordinary admin prospect edits preserve consent by spread and do not accept consent mutation fields',()=>{
  const start=account.indexOf('async function adminWebsiteProspectUpdate');
  const end=account.indexOf('async function adminProspectSave',start);
  assert.ok(start>=0&&end>start);
  const update=account.slice(start,end);
  assert.match(update,/const next=\{\.\.\.old,stage,/);
  assert.doesNotMatch(update,/body\.marketingEmailConsent/);
  assert.doesNotMatch(update,/marketingEmailConsent:/);
  const saveEnd=account.indexOf('async function adminMarketingCampaigns',end);
  const create=account.slice(end,saveEnd);
  assert.doesNotMatch(create,/marketingEmailConsent:/);
});
