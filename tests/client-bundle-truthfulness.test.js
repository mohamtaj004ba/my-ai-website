const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');

function extract(name,next){
  const start=source.indexOf('async function '+name+'('),end=source.indexOf('\nasync function '+next+'(',start);
  assert.ok(start>=0&&end>start,name+' handler exists');
  return source.slice(start,end);
}
function basicFixture(block,{value,workspace={id:'client',plan:'Growth'},query={}}={}){
  let status=0,payload;
  const ctx=vm.createContext({
    requireSession:async()=>({workspaceId:'client',email:'owner@example.test'}),
    kv:{get:async key=>key==='workspace:client'?workspace:value},
    entitlementsFor:()=>({features:{apiAccess:true},locations:1}),clientRouting:()=>({}),process:{env:{}},
    req:{query},res:{status(n){status=n;return this},json(x){payload=x;return x}},Array,Object,String,Number
  });
  vm.runInContext(block,ctx);
  return {ctx,run:async fn=>{await vm.runInContext(fn+'(req,res)',ctx);return {status,payload}}};
}

test('settings read refuses malformed storage instead of substituting defaults',async()=>{
  const block=extract('settings','saveSettings'),f=basicFixture(block,{value:['corrupt']});
  const r=await f.run('settings');assert.equal(r.status,503);assert.match(r.payload.error,/No default settings were substituted/);
});
test('integrations read refuses malformed storage instead of fake disconnected integrations',async()=>{
  const block=extract('integrations','saveIntegrations'),f=basicFixture(block,{value:['corrupt']});
  const r=await f.run('integrations');assert.equal(r.status,503);assert.match(r.payload.error,/No default integration state was substituted/);
});
test('phone routing read refuses malformed inventory instead of fake unassigned routing',async()=>{
  const block=extract('phoneRouting','locations'),f=basicFixture(block,{value:{corrupt:true}});
  const r=await f.run('phoneRouting');assert.equal(r.status,503);assert.match(r.payload.error,/No unassigned routing state was substituted/);
});
test('call detail refuses malformed call storage instead of returning Call not found',async()=>{
  const block=extract('callDetail','calls'),f=basicFixture(block,{value:{corrupt:true},query:{id:'call-1'}});
  const r=await f.run('callDetail');assert.equal(r.status,503);assert.match(r.payload.error,/No missing-call result was substituted/);
});
test('bundled client dashboard validates secondary/provider records before replacing last-good UI state',()=>{
  const block=extract('clientDashboardData','callDetail');
  assert.match(block,/const invalid=\[/);
  assert.match(block,/Last verified dashboard data should be preserved/);
  assert.match(block,/legacyCalls!=null&&!Array\.isArray\(legacyCalls\)/);
  assert.doesNotMatch(block,/numbers=Array\.isArray\(phoneIndex\)\?phoneIndex:\[\]/);
});

test('bundled client dashboard validates rows inside provider-backed arrays and receptionist questions',()=>{
  const block=extract('clientDashboardData','callDetail');
  assert.match(block,/\['call index',callIndexRaw,v=>Array\.isArray\(v\)&&v\.every/);
  assert.match(block,/\['phone routing',phoneIndex,v=>Array\.isArray\(v\)&&v\.every/);
  assert.match(block,/qualificationQuestions==null\|\|Array\.isArray\(v\.qualificationQuestions\)/);
});

test('bundled client dashboard validates workspace identity and usage before returning fallback values',()=>{
  const block=extract('clientDashboardData','callDetail');
  assert.match(block,/Workspace dashboard data is unavailable\. Last verified dashboard data should be preserved/);
  assert.match(block,/Workspace usage data is unavailable\. Last verified dashboard data should be preserved/);
  assert.match(block,/Number\.isFinite\(Number\(ws\.usage\.minutes\)\)/);
});

test('bundled client dashboard validates onboarding checklist shape before applying progress',()=>{
  const block=extract('clientDashboardData','callDetail');
  assert.match(block,/\['onboarding',onboardingRaw,v=>v&&typeof v==='object'&&!Array\.isArray\(v\)&&\(v\.checklist==null/);
});

test('bundled client dashboard validates canonical opened-call ids and nested follow-up notes',()=>{
  const block=extract('clientDashboardData','callDetail');
  assert.match(block,/\['call opened state',viewedRaw,v=>Array\.isArray\(v\)&&v\.length<=2000/);
  assert.match(block,/new Set\(v\)\.size===v\.length/);
  assert.doesNotMatch(block,/viewedRaw\.map\(String\)/);
  assert.match(block,/\['follow-up state',followupRaw,v=>v&&typeof v==='object'&&!Array\.isArray\(v\)&&Object\.values\(v\)\.every/);
  assert.match(block,/item\.notes\.every\(note=>/);
});
