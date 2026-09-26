const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync('api/stripe-webhook.js','utf8');
const start=source.indexOf('  const workspace=await upsertWorkspace({lead,session,plan:paidPlan,email:recipient});');
const end=source.indexOf('\n};',start);
assert.ok(start>=0&&end>start);
const paidPath=source.slice(start,end);
async function run({trackError=false,workspaceError=false}={}){
  const writes=[],steps=[];let status,body;
  const ctx=vm.createContext({
    lead:{prospectId:'lead-1',email:'paid@example.test',name:'Paid Client',business:'Paid business',visitorId:'visitor',sessionId:'session-1'},
    session:{id:'cs_test',customer:'cus_test'},paidPlan:'Pro',recipient:'paid@example.test',
    token:null,sessionKey:'stripe:session:cs_test',eventKey:'stripe:event:evt_test',
    upsertWorkspace:async()=>{steps.push('workspace');if(workspaceError)throw Error('workspace storage unavailable');return {id:'workspace-1',name:'Paid business'}},
    upsertWebsiteProspect:async()=>{steps.push('prospect')},
    recordSiteEvent:async()=>{steps.push('tracking');if(trackError)throw Error('analytics unavailable')},
    entitlementsFor:()=>({price:500}),
    kv:{get:async()=>null,set:async(key,value)=>{writes.push({key,value});steps.push('set:'+key)}},
    addBusinessHours:()=>123456,crypto,Date,Number,String,console:{error(){}},safeError:()=> 'redacted',
    lifecycleEmail:()=>({text:'Welcome',html:'Welcome'}),
    SITE_URL:'https://callercore.com',sendMail:async()=>{steps.push('mail')},
    res:{status(n){status=n;return this},json(x){body=x;return x}}
  });
  let error;
  try{await vm.runInContext('(async()=>{'+paidPath+'})()',ctx)}
  catch(err){error=err}
  return {status,body,writes,steps,error};
}
test('paid onboarding and event acknowledgement proceed after analytics recording fails',async()=>{
  const r=await run({trackError:true});
  assert.equal(r.error,undefined);
  assert.equal(r.status,200);
  assert.equal(r.body.received,true);
  assert.equal(r.body.workspaceId,'workspace-1');
  assert.ok(r.writes.some(w=>w.key==='onboarding:workspace:workspace-1'));
  assert.ok(r.writes.some(w=>w.key==='onboarding:workspace-token:workspace-1'));
  assert.ok(r.writes.some(w=>w.key==='stripe:event:evt_test'&&w.value===true));
  assert.ok(r.steps.indexOf('tracking')<r.steps.indexOf('set:onboarding:workspace:workspace-1'));
  assert.ok(r.steps.includes('mail'));
});
test('failing critical workspace creation does not falsely acknowledge a paid checkout',async()=>{
  const r=await run({workspaceError:true});
  assert.match(r.error.message,/workspace storage unavailable/);
  assert.equal(r.status,undefined);
  assert.equal(r.writes.length,0);
  assert.ok(!r.steps.includes('tracking'));
});
test('paid checkout telemetry is explicitly best effort and uses redacted errors',()=>{
  assert.match(paidPath,/try\{await recordSiteEvent\(\{type:'checkout_complete'/);
  assert.match(paidPath,/catch\(analyticsError\)\{console\.error\('Paid checkout analytics unavailable',safeError\(analyticsError\)\)\}/);
});

const guardStart=source.indexOf('  if(sessionState&&(sessionState.status===\'complete\'');
const guardEnd=source.indexOf('\n\n  const leadId=',guardStart);
assert.ok(guardStart>=0&&guardEnd>guardStart);
const sessionGuard=source.slice(guardStart,guardEnd);
async function dedupe(sessionState){
  const writes=[];let status,body;
  const ctx=vm.createContext({sessionState,eventKey:'stripe:event:new-event',
    kv:{set:async(key,value,options)=>{writes.push({key,value,options})}},
    res:{status(n){status=n;return this},json(x){body=x;return x}}});
  await vm.runInContext('(async()=>{'+sessionGuard+'})()',ctx);
  return {status,body,writes};
}
test('later paid event with distinct ID for already-reviewed checkout is acknowledged as duplicate',async()=>{
  const r=await dedupe({status:'awaiting_review',token:'onboard-token',workspaceId:'workspace-1'});
  assert.equal(r.status,200);
  assert.equal(r.body.received,true);
  assert.equal(r.body.duplicate,true);
  assert.equal(r.body.workspaceId,'workspace-1');
  assert.equal(r.writes.length,1);
  assert.equal(r.writes[0].key,'stripe:event:new-event');
  assert.equal(r.writes[0].value,true);
  assert.ok(guardStart<source.indexOf('  const workspace=await upsertWorkspace('));
});
test('incomplete session state can still resume provisioning while complete status is idempotent',async()=>{
  const partial=await dedupe({status:'awaiting_review',workspaceId:'workspace-1'});
  assert.equal(partial.status,undefined);
  assert.equal(partial.writes.length,0);
  const complete=await dedupe({status:'complete',workspaceId:'workspace-1',token:'onboard-token'});
  assert.equal(complete.status,200);
  assert.equal(complete.body.duplicate,true);
});
