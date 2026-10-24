const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('api/account.js','utf8');
const start=source.indexOf('async function adminSendOnboardingInvite(');
const end=source.indexOf('\nasync function adminProvisioningChecklistSave(',start);
const code=source.slice(start,end);

function makeFixture({mail='success',delivery=null,claimConflict=false}={}){
  let uuid=0,status=200,result,sendCalls=0;
  const state={workspaceId:'tenant',status:'awaiting_review',reviewEligibleAt:0,checklist:{payment:true},updatedAt:10,...(delivery?{onboardingInviteDelivery:delivery}:{})};
  const records={
    'workspace:tenant':{id:'tenant',name:'Client',ownerName:'Taylor Client',ownerEmail:'client@example.com'},
    'onboarding:workspace:tenant':state,
    'onboarding:workspace-token:tenant':'token-1',
    'onboarding:token-1':{email:'client@example.com',name:'Taylor Client'}
  };
  const audits=[];
  const ctx=vm.createContext({
    requireAdmin:async()=>({email:'admin@callercore.com'}),kv:{get:async key=>records[key]},
    compareAndAudit:async(_,update,auditKey,event)=>{
      if(claimConflict&&event.action==='onboarding_invite_send_started')return false;
      assert.equal(auditKey,'audit:tenant');assert.deepEqual(records[update.key],update.before);
      records[update.key]=update.after;audits.push(event);return true;
    },
    crypto:{randomUUID:()=> 'uuid-'+(++uuid)},Date,requestOrigin:()=> 'https://preview.example',
    lifecycleEmail:()=>({text:'text',html:'html'}),
    sendMail:async()=>{sendCalls++;if(mail==='failed')throw Object.assign(Error('reject'),{deliveryState:'failed',code:'MAIL_PROVIDER_REJECTED'});if(mail==='uncertain')throw Object.assign(Error('network'),{deliveryState:'uncertain',code:'MAIL_TRANSPORT_UNCERTAIN'});return '{"id":"queued"}'},
    safeError:err=>String(err&&err.message||err),console:{error:()=>{}},String,Array,Object,Number,Math,Promise,
    req:{body:{id:'tenant'}},res:{status(n){status=n;return this},json(x){result=x;return x}}
  });
  vm.runInContext(code,ctx);
  return {
    records,audits,ctx,get result(){return result},get status(){return status},get sendCalls(){return sendCalls},
    send:async()=>{status=200;result=undefined;await vm.runInContext('adminSendOnboardingInvite(req,res)',ctx);return {status,result}},
    resolve:async(resolution,attemptId='')=>{status=200;result=undefined;ctx.req.body={id:'tenant',resolution,attemptId};await vm.runInContext('adminResolveOnboardingInviteDelivery(req,res)',ctx);ctx.req.body={id:'tenant'};return {status,result}}
  };
}

test('successful onboarding invite claims once, sends once and finalizes a confirmed sent state',async()=>{
  const f=makeFixture(),first=await f.send();
  assert.equal(first.status,200);assert.equal(first.result.deliveryStatus,'sent');assert.equal(f.sendCalls,1);
  const saved=f.records['onboarding:workspace:tenant'];assert.equal(saved.onboardingLinkSent,true);assert.equal(saved.onboardingInviteDelivery.status,'sent');
  assert.deepEqual(f.audits.map(x=>x.action),['onboarding_invite_send_started','onboarding_invite_sent']);
  const second=await f.send();assert.equal(second.status,200);assert.equal(second.result.alreadySent,true);assert.equal(f.sendCalls,1);
});

test('provider rejection records a retry-safe failed state and permits a later retry',async()=>{
  const f=makeFixture({mail:'failed'}),first=await f.send();
  assert.equal(first.status,502);assert.equal(first.result.deliveryStatus,'failed');assert.equal(first.result.retrySafe,true);assert.equal(f.sendCalls,1);
  assert.equal(f.records['onboarding:workspace:tenant'].onboardingInviteDelivery.status,'failed');
  f.ctx.sendMail=async()=>{f.ctx.__sendCount=(f.ctx.__sendCount||0)+1;return '{"id":"queued"}'};
  const second=await f.send();assert.equal(second.status,200);assert.equal(second.result.deliveryStatus,'sent');
});

test('uncertain transport result blocks automatic resend until an admin resolves delivery',async()=>{
  const f=makeFixture({mail:'uncertain'}),first=await f.send();
  assert.equal(first.status,503);assert.equal(first.result.deliveryStatus,'uncertain');assert.equal(first.result.retrySafe,false);assert.equal(f.sendCalls,1);
  const second=await f.send();assert.equal(second.status,409);assert.equal(second.result.code,'ONBOARDING_INVITE_DELIVERY_UNCERTAIN');assert.equal(f.sendCalls,1);
  const attemptId=f.records['onboarding:workspace:tenant'].onboardingInviteDelivery.attemptId;
  const resolved=await f.resolve('not_sent',attemptId);assert.equal(resolved.status,200);assert.equal(resolved.result.deliveryStatus,'failed');assert.equal(resolved.result.retrySafe,true);
});

test('confirmed sent resolution advances onboarding without sending another email',async()=>{
  const f=makeFixture({delivery:{status:'uncertain',attemptId:'prior',startedAt:1,finishedAt:2}}),resolved=await f.resolve('sent','prior');
  assert.equal(resolved.status,200);assert.equal(f.sendCalls,0);
  const saved=f.records['onboarding:workspace:tenant'];assert.equal(saved.onboardingLinkSent,true);assert.equal(saved.status,'awaiting_agreement');assert.equal(saved.checklist.onboardingSent,true);assert.equal(saved.onboardingInviteDelivery.status,'sent');
});

test('fresh sending claim blocks duplicate sends and stale sending claim requires review',async()=>{
  const fresh=makeFixture({delivery:{status:'sending',attemptId:'fresh',startedAt:Date.now()}});
  let r=await fresh.send();assert.equal(r.status,409);assert.equal(r.result.code,'ONBOARDING_INVITE_DELIVERY_IN_PROGRESS');assert.equal(fresh.sendCalls,0);
  const stale=makeFixture({delivery:{status:'sending',attemptId:'stale',startedAt:Date.now()-16*60*1000}});
  r=await stale.send();assert.equal(r.status,409);assert.equal(r.result.code,'ONBOARDING_INVITE_DELIVERY_UNCERTAIN');assert.equal(stale.sendCalls,0);
});

test('a failed atomic claim never sends the onboarding email',async()=>{
  const f=makeFixture({claimConflict:true}),r=await f.send();
  assert.equal(r.status,409);assert.equal(f.sendCalls,0);
});

test('provisioning response exposes only bounded delivery state needed by the admin UI',()=>{
  const begin=source.indexOf('async function adminProvisioning('),finish=source.indexOf('\nfunction validProvisioningHistory',begin),body=source.slice(begin,finish);
  for(const token of ['inviteDeliveryStatus','inviteDeliveryAttemptId','inviteDeliveryStartedAt','inviteDeliveryFinishedAt','inviteDeliveryNeedsReview'])assert.ok(body.includes(token),token);
  assert.doesNotMatch(body,/lastErrorCode:/);
});

test('account router exposes the guarded delivery-resolution action',()=>{
  assert.match(source,/action==='admin-onboarding-delivery-resolve'&&req\.method==='POST'/);
});

test('onboarding invite refuses malformed workspace, delivery, checklist, token, or intake sources before mail send',()=>{
  assert.match(code,/Client workspace record is unavailable\. No onboarding email was sent/);
  assert.match(code,/Onboarding token mapping is unavailable\. No email was sent/);
  assert.match(code,/Onboarding delivery state is unavailable\. No email was sent/);
  assert.match(code,/Onboarding checklist is unavailable\. No email was sent/);
  assert.match(code,/Onboarding intake record is unavailable\. No email was sent/);
});
test('delivery resolution distinguishes malformed state from a missing onboarding record',()=>{
  assert.match(code,/Onboarding state is unavailable\. Delivery was not resolved/);
  assert.match(code,/Onboarding delivery state is unavailable\. Delivery was not resolved/);
  assert.match(code,/Onboarding checklist is unavailable\. Delivery was not resolved/);
});
