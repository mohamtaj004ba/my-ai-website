const test=require('node:test');
const assert=require('node:assert/strict');
const {classifyReadiness,VERIFIED_APPLICATION}=require('../lib/system-readiness');
const {LIVE_BILLING_AUDIT,SUPPORT_EMAIL_EVIDENCE}=require('../lib/billing-readiness');
const row=(key,status='pending')=>({key,name:key,status,detail:'Check '+key});
const fs=require('node:fs'),vm=require('node:vm'),api=fs.readFileSync('api/account.js','utf8');
async function healthResponse({storage='preview-isolated',kvOk=true,scopeOk=true,gates={}}={}){
  let response;
  const context=vm.createContext({process:{env:{VERCEL_ENV:'preview',MAILGUN_API_KEY:'fixture',MAILGUN_DOMAIN:'fixture',OPENAI_API_KEY:'fixture'}},Date,Map,Set,Promise,
    requireAdmin:async()=>({role:'admin'}),monthWindow:()=>({month:'2026-10'}),kvHealthCheck:async()=>({ok:kvOk,error:'unavailable'}),stripeConfigurationHealth:async()=>({ok:false}),
    kv:{get:async key=>key==='platform:settings'?{launchGates:gates}:key==='phone:index'?[]:null},loadAdminWorkspaces:async()=>[],
    environmentScopeHealth:()=>({ok:scopeOk,env:'preview',issues:[],detail:'Fixture scope check'}),gmailConfigReady:()=>true,storageEnvironment:()=>storage,
    classifyReadiness,VERIFIED_APPLICATION,LIVE_BILLING_AUDIT,SUPPORT_EMAIL_EVIDENCE,
    req:{},res:{status(code){assert.equal(code,200);return this},json(value){response=value;return value}}
  });
  const gatesStart=api.indexOf('const LAUNCH_GATE_DEFS='),gatesEnd=api.indexOf('\nfunction clampInt',gatesStart);
  vm.runInContext(api.slice(gatesStart,gatesEnd),context);
  const start=api.indexOf('async function adminSystemHealth('),end=api.indexOf('\nasync function adminClient(',start);
  vm.runInContext(api.slice(start,end),context);await vm.runInContext('adminSystemHealth(req,res)',context);
  return response;
}
test('API reports verified isolated Preview without fabricating owner or voice confirmation',async()=>{
  const result=await healthResponse(),isolation=result.services.find(x=>x.key==='gate-previewIsolation');
  assert.equal(isolation.state,'operational');assert.equal(isolation.ownerConfirmed,false);assert.equal(result.readiness.ready,false);
  assert.equal(result.services.find(x=>x.key==='application-e2e').state,'operational');assert.equal(result.services.find(x=>x.key==='gate-voiceLifecycle').state,'blocked');
  assert.equal(result.readiness.counts.releaseSetup,4);assert.equal(result.readiness.counts.ownerActions,2);assert.equal(result.readiness.counts.technicalBlockers,2);
});
test('API never infers isolated storage from standard storage',async()=>{
  assert.equal((await healthResponse({storage:'standard'})).services.find(x=>x.key==='gate-previewIsolation').state,'blocked');
});
test('API isolation evidence cannot override a failed current KV check',async()=>{
  const result=await healthResponse({kvOk:false});assert.equal(result.services.find(x=>x.key==='gate-previewIsolation').state,'blocked');assert.equal(result.services.find(x=>x.key==='database').state,'blocked');
});
test('API isolation evidence cannot override dangerous current environment scope',async()=>{
  const result=await healthResponse({scopeOk:false});assert.equal(result.services.find(x=>x.key==='gate-previewIsolation').state,'blocked');assert.equal(result.services.find(x=>x.key==='environment-scope').state,'blocked');
});
test('closed checkout and missing production Stripe are release setup, not technical failures',()=>{
  const {services,readiness}=classifyReadiness([row('checkout'),row('stripe')],['checkout','stripe']);
  assert.deepEqual(services.map(x=>x.state),['launch-gated','release-verification-required']);
  assert.equal(readiness.counts.technicalBlockers,0);assert.equal(readiness.counts.releaseSetup,2);assert.equal(readiness.ready,false);
});
test('owner confirmations do not enter core-health denominator',()=>{
  const {readiness,services}=classifyReadiness([row('database','operational'),row('gate-businessTax'),row('gate-legalReview')],['database','gate-businessTax','gate-legalReview']);
  assert.deepEqual(readiness.core,{healthy:1,total:1});assert.equal(readiness.counts.ownerActions,2);assert.equal(readiness.blockers.length,0);assert.equal(readiness.ready,false);
  assert.equal(services[1].state,'external-owner-action');
});
test('voice configuration and lifecycle are independent genuine technical blockers',()=>{
  let result=classifyReadiness([row('voice','not_configured'),row('gate-voiceLifecycle')],['voice','gate-voiceLifecycle']);
  assert.equal(result.readiness.blockers.length,2);
  result=classifyReadiness([row('voice','configured'),row('gate-voiceLifecycle')],['voice','gate-voiceLifecycle']);
  assert.deepEqual(result.readiness.blockers.map(x=>x.key),['gate-voiceLifecycle']);
  assert.equal(classifyReadiness([row('voice','configured'),row('gate-voiceLifecycle','confirmed')],['voice','gate-voiceLifecycle']).readiness.ready,true);
});
test('verified application and isolation evidence do not complete voice lifecycle',()=>{
  const result=classifyReadiness([row('gate-previewIsolation','operational'),row('application-e2e','operational'),row('gate-voiceLifecycle')],['gate-voiceLifecycle']);
  assert.deepEqual(result.readiness.core,{healthy:2,total:2});assert.equal(result.readiness.ready,false);assert.equal(result.readiness.blockers[0].key,'gate-voiceLifecycle');
  assert.match(VERIFIED_APPLICATION.url,/37269220204$/);
});
test('optional failures remain optional and counts account for every service',()=>{
  const result=classifyReadiness([row('database','error'),row('voice'),row('checkout'),row('gate-businessTax'),row('demo'),row('analytics-rollup')],['database','voice','checkout','gate-businessTax']);
  assert.equal(result.readiness.counts.optionalSetup,2);assert.equal(result.services.filter(x=>x.category==='optional').every(x=>x.state==='optional'),true);
  assert.equal(result.readiness.total,6);assert.equal(result.readiness.counts.technicalBlockers,2);assert.equal(result.readiness.launchOutstanding.length,4);
});
test('core live failures remain blockers despite historical application QA',()=>{
  const result=classifyReadiness([row('environment-scope','error'),row('application-e2e','operational')],['environment-scope']);
  assert.equal(result.readiness.ready,false);assert.deepEqual(result.readiness.core,{healthy:1,total:2});assert.equal(result.readiness.blockers[0].key,'environment-scope');
});
