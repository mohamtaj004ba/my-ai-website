const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {PassThrough}=require('node:stream');
const sessionLock=require('../lib/stripe-session-lock');
const reconciliation=require('../lib/stripe-reconciliation');
const source=fs.readFileSync('api/stripe-webhook.js','utf8');
function deferred(){
  let resolve;
  const promise=new Promise(r=>{resolve=r});
  return {promise,resolve};
}
function fixture({blockFirstWorkspace=false,failFirstWorkspace=false}={}){
  const store=new Map(),locks=new Map(),reconciliationIndex=[],entered=deferred(),resume=deferred();
  let welcomes=0,workspaces=0,telemetry=0,failed=false;const emailOptions=[];
  store.set('lead:lead-reference',{prospectId:'p-1',name:'Customer',business:'Business',
    email:'customer@example.test',phone:'5551231234',industry:'Services',plan:'Pro'});
  const kv={
    get:async key=>store.get(key)??null,
    set:async(key,value)=>{
      if(key.startsWith('workspace:')){
        workspaces++;
        if(failFirstWorkspace&&!failed){failed=true;throw Error('workspace persistence failed')}
        if(blockFirstWorkspace&&workspaces===1){entered.resolve();await resume.promise}
      }
      store.set(key,value);return 'OK';
    },
    eval:async(script,keys,args)=>{
      const key=keys[0];
      if(script===sessionLock.CLAIM_CHECKOUT_SESSION){
        if(locks.has(key))return 0;
        locks.set(key,args[0]);return 1;
      }
      if(script===sessionLock.RELEASE_CHECKOUT_SESSION){
        if(locks.get(key)!==args[0])return 0;
        locks.delete(key);return 1;
      }
      if(script===reconciliation.RECONCILIATION_RECORD){
        if(store.has(key))return 0;
        store.set(key,JSON.parse(args[0]));
        reconciliationIndex.unshift(args[1]);reconciliationIndex.splice(200);
        return 1;
      }
      if(script===reconciliation.RESOLVE_RECONCILIATION){
        const record=store.get(key);
        if(!record)return 0;
        if(record.sessionId!==args[0])return -1;
        if(record.status!=='open')return 0;
        store.set(key,{...record,status:'resolved',resolvedAt:Number(args[1])});
        return 1;
      }
      throw Error('Unexpected script');
    }
  };
  const modules={
    crypto,'../lib/kv':{kv},
    '../lib/mail':{sendMail:async()=>{welcomes++}},
    '../lib/safe-log':{safeError:()=> 'redacted'},
    '../lib/email-template':{lifecycleEmail:opts=>{emailOptions.push(opts);return {text:'Thanks',html:'Thanks'}},esc:input=>String(input).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')},
    '../lib/plans':{normalizePlan:p=>p,entitlementsFor:p=>({plan:p,price:999})},
    '../lib/site-analytics':{
      recordSiteEvent:async()=>{telemetry++},
      upsertWebsiteProspect:async()=>({id:'p-1'})
    },
    '../lib/business-hours':{addBusinessHours:n=>n+7200000},
    '../lib/stripe-lifecycle':{lifecycleDecision:()=>({apply:false})},
    '../lib/stripe-session-lock':sessionLock,
    '../lib/stripe-reconciliation':reconciliation
  };
  const module={exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,require:name=>{
    if(!(name in modules))throw Error('Unexpected module '+name);
    return modules[name]
  },process:{env:{STRIPE_WEBHOOK_SECRET:'test-webhook-secret',SITE_URL:'https://callercore.com'}},
  Buffer,Date,Math,Number,String,Object,Array,Promise,Set,console:{error(){}},URL});
  const handler=module.exports;
  async function submit(eventId,checkoutId='cs_same',options={}){
    const event={id:eventId,type:'checkout.session.completed',data:{object:{
      id:checkoutId,payment_status:'paid',client_reference_id:options.leadId||'lead-reference',
      customer:options.customerId||'cus_same',subscription:options.subscriptionId||'sub_same',metadata:{plan:'Pro'},
      customer_details:{email:options.email||'customer@example.test',name:'Customer'}
    }}};
    const raw=JSON.stringify(event),timestamp=String(Math.floor(Date.now()/1000));
    const signature=crypto.createHmac('sha256','test-webhook-secret').update(timestamp+'.'+raw).digest('hex');
    const req=new PassThrough();req.method='POST';req.headers={'stripe-signature':'t='+timestamp+',v1='+signature};
    const result={status:null,body:null,headers:{}};
    const res={
      setHeader(k,v){result.headers[k]=v;return this},
      status(n){result.status=n;return this},
      json(payload){result.body=payload;return payload}
    };
    const pending=handler(req,res);
    req.end(raw);
    await pending;
    return result;
  }
  return {submit,entered,resume,store,locks,emailOptions,reconciliationIndex,get welcomes(){return welcomes},get workspaces(){return workspaces},get telemetry(){return telemetry}};
}
test('simultaneous Stripe event IDs cannot duplicate paid onboarding or welcome mail',async()=>{
  const f=fixture({blockFirstWorkspace:true});
  const initial=f.submit('evt_first');
  await f.entered.promise;
  const overlapping=await f.submit('evt_second');
  assert.equal(overlapping.status,503);
  assert.equal(overlapping.headers['Retry-After'],'15');
  assert.equal(f.store.has('stripe:event:evt_second'),false);
  assert.equal(f.welcomes,0);
  f.resume.resolve();
  const done=await initial;
  assert.equal(done.status,200);
  assert.equal(done.body.received,true);
  assert.equal(f.welcomes,1);
  assert.equal(f.locks.size,0);
  const progress=f.store.get('onboarding:workspace:'+done.body.workspaceId);
  progress.checklist.adminReview=true;
  const retry=await f.submit('evt_third');
  assert.equal(retry.status,200);
  assert.equal(retry.body.duplicate,true);
  assert.equal(f.welcomes,1);
  assert.equal(f.store.get('onboarding:workspace:'+done.body.workspaceId).checklist.adminReview,true);
  assert.equal(f.store.get('stripe:event:evt_third'),true);
});
test('failed critical provisioning releases the claim without acknowledging event',async()=>{
  const f=fixture({failFirstWorkspace:true});
  await assert.rejects(()=>f.submit('evt_first'),/workspace persistence failed/);
  assert.equal(f.locks.size,0);
  assert.equal(f.store.has('stripe:event:evt_first'),false);
  const retry=await f.submit('evt_first');
  assert.equal(retry.status,200);
  assert.equal(f.welcomes,1);
  assert.equal(f.locks.size,0);
  assert.equal(f.store.get('stripe:event:evt_first'),true);
});

test('separate repeat checkout keeps existing review and live setup milestones intact',async()=>{
  const f=fixture();
  const initial=await f.submit('evt_first','cs_first');
  assert.equal(initial.status,200);
  const workspaceId=initial.body.workspaceId;
  const key='onboarding:workspace:'+workspaceId;
  const previous=f.store.get(key);
  previous.status='live';
  previous.paidAt=1111;
  previous.reviewEligibleAt=2222;
  previous.onboardingLinkSent=true;
  previous.completionPercent=100;
  previous.checklist={...previous.checklist,payment:true,agreement:true,intake:true,adminReview:true,testCall:true,live:true};
  previous.intake={businessName:'Established customer'};
  const repeat=await f.submit('evt_second','cs_second');
  assert.equal(repeat.status,200);
  assert.equal(repeat.body.workspaceId,workspaceId);
  const later=f.store.get(key);
  assert.equal(later.status,'live');
  assert.equal(later.paidAt,1111);
  assert.equal(later.reviewEligibleAt,2222);
  assert.equal(later.onboardingLinkSent,true);
  assert.equal(later.completionPercent,100);
  assert.equal(later.checklist.agreement,true);
  assert.equal(later.checklist.adminReview,true);
  assert.equal(later.checklist.testCall,true);
  assert.equal(later.checklist.live,true);
  assert.equal(later.intake.businessName,'Established customer');
  assert.ok(later.lastCheckoutAt>=later.paidAt);
  assert.equal(f.locks.size,0);
});

test('repeat checkout reuses valid signed onboarding token instead of starting a new agreement',async()=>{
  const f=fixture();
  const first=await f.submit('evt_first','cs_first');
  assert.equal(first.status,200);
  const workspaceId=first.body.workspaceId;
  const priorToken=f.store.get('onboarding:workspace-token:'+workspaceId);
  assert.ok(priorToken);
  const onboarding=f.store.get('onboarding:'+priorToken);
  onboarding.agreementSigned=true;
  onboarding.agreementSignedAt=123456;
  onboarding.intake={businessName:'Existing intake'};
  onboarding.status='intake_complete';
  const tokensBefore=[...f.store.keys()].filter(k=>k.startsWith('onboarding:')&&!k.startsWith('onboarding:workspace')).length;
  const next=await f.submit('evt_second','cs_second');
  assert.equal(next.status,200);
  assert.equal(f.store.get('onboarding:workspace-token:'+workspaceId),priorToken);
  const saved=f.store.get('onboarding:'+priorToken);
  assert.equal(saved.agreementSigned,true);
  assert.equal(saved.agreementSignedAt,123456);
  assert.equal(saved.intake.businessName,'Existing intake');
  assert.equal(saved.status,'intake_complete');
  const tokensAfter=[...f.store.keys()].filter(k=>k.startsWith('onboarding:')&&!k.startsWith('onboarding:workspace')).length;
  assert.equal(tokensAfter,tokensBefore);
});
test('foreign workspace token cannot be adopted during repeat checkout',async()=>{
  const f=fixture();
  const first=await f.submit('evt_first','cs_first');
  const workspaceId=first.body.workspaceId;
  f.store.set('onboarding:workspace-token:'+workspaceId,'foreign-token');
  f.store.set('onboarding:foreign-token',{workspaceId:'someone-else',agreementSigned:true});
  const next=await f.submit('evt_second','cs_second');
  assert.equal(next.status,200);
  assert.notEqual(f.store.get('onboarding:workspace-token:'+workspaceId),'foreign-token');
  assert.equal(f.store.get('onboarding:foreign-token').workspaceId,'someone-else');
});

test('repeat checkout receipt describes existing account rather than newly created onboarding',async()=>{
  const f=fixture();
  await f.submit('evt_first','cs_first');
  const existing=await f.submit('evt_second','cs_second');
  assert.equal(existing.status,200);
  assert.equal(f.emailOptions.length,2);
  assert.match(f.emailOptions[0].title,/Welcome to CallerCore/);
  assert.match(f.emailOptions[1].title,/payment is confirmed/);
  assert.match(f.emailOptions[1].statusText,/setup progress remains in place/);
  assert.doesNotMatch(f.emailOptions[1].bodyHtml,/secure onboarding link and service agreement/);
});
test('HTML payment confirmation escapes business name rather than injecting markup',async()=>{
  const f=fixture();
  f.store.get('lead:lead-reference').business='<img src=x onerror=alert(1)> & Co';
  await f.submit('evt_first','cs_first');
  assert.match(f.emailOptions[0].intro,/&lt;img src=x onerror=alert\(1\)&gt; &amp; Co/);
  assert.doesNotMatch(f.emailOptions[0].intro,/<img/);
});

test('different checkout sessions for the same account cannot provision simultaneously',async()=>{
  const f=fixture({blockFirstWorkspace:true});
  const first=f.submit('evt_first','cs_first');
  await f.entered.promise;
  const second=await f.submit('evt_second','cs_second');
  assert.equal(second.status,503);
  assert.equal(second.headers['Retry-After'],'15');
  assert.equal(second.body.received,undefined);
  assert.equal(f.store.has('stripe:event:evt_second'),false);
  assert.equal(f.welcomes,0);
  // Session lock for the waiting checkout is released; account claims stay
  // with the worker currently performing customer provisioning.
  assert.equal(f.locks.size,3);
  f.resume.resolve();
  const finished=await first;
  assert.equal(finished.status,200);
  assert.equal(f.locks.size,0);
  const retried=await f.submit('evt_second','cs_second');
  assert.equal(retried.status,200);
  assert.equal(retried.body.workspaceId,finished.body.workspaceId);
  assert.equal(f.welcomes,2);
  assert.equal(f.locks.size,0);
});
test('account claim keys do not expose raw checkout email or Stripe customer',async()=>{
  const f=fixture({blockFirstWorkspace:true});
  const first=f.submit('evt_first','cs_first');
  await f.entered.promise;
  const keys=[...f.locks.keys()];
  assert.equal(keys.length,3);
  assert.ok(keys.some(key=>key.includes('account-email:')));
  assert.ok(keys.some(key=>key.includes('account-customer:')));
  assert.ok(keys.every(key=>!key.includes('customer@example.test')&&!key.includes('cus_same')));
  f.resume.resolve();
  await first;
});
test('failed account provisioning releases session and account identity claims',async()=>{
  const f=fixture({failFirstWorkspace:true});
  await assert.rejects(()=>f.submit('evt_failure','cs_first'),/workspace persistence failed/);
  assert.equal(f.locks.size,0);
  const retry=await f.submit('evt_retry','cs_second');
  assert.equal(retry.status,200);
  assert.equal(f.locks.size,0);
});

test('distinct Stripe customer IDs sharing one account email also serialize provisioning',async()=>{
  const f=fixture({blockFirstWorkspace:true});
  const first=f.submit('evt_a','cs_a',{customerId:'cus_a',subscriptionId:'sub_a'});
  await f.entered.promise;
  const overlapping=await f.submit('evt_b','cs_b',{customerId:'cus_b',subscriptionId:'sub_b'});
  assert.equal(overlapping.status,503);
  assert.equal(f.store.has('stripe:event:evt_b'),false);
  assert.equal(f.welcomes,0);
  assert.equal(f.locks.size,3);
  f.resume.resolve();
  const done=await first;
  assert.equal(done.status,200);
  assert.equal(f.locks.size,0);
  const retry=await f.submit('evt_b','cs_b',{customerId:'cus_b',subscriptionId:'sub_b'});
  assert.equal(retry.status,200);
  assert.equal(retry.body.workspaceId,done.body.workspaceId);
  assert.equal(f.welcomes,2);
  assert.equal(f.locks.size,0);
});

test('reuses a Stripe-mapped workspace only when checkout email matches its owner',async()=>{
  const f=fixture();
  f.store.set('workspace:existing-ws',{id:'existing-ws',ownerEmail:'customer@example.test',name:'Existing business',status:'live'});
  f.store.set('stripe:customer:cus_same','existing-ws');
  const result=await f.submit('evt_first','cs_first');
  assert.equal(result.status,200);
  assert.equal(result.body.workspaceId,'existing-ws');
  assert.equal(f.store.get('user:email:customer@example.test').workspaceId,'existing-ws');
  assert.equal(f.store.get('stripe:customer:cus_same'),'existing-ws');
});
test('refuses to reassign existing Stripe customer mapping to an unrelated checkout email',async()=>{
  const f=fixture();
  f.store.set('workspace:existing-ws',{id:'existing-ws',ownerEmail:'different@example.test',name:'Other customer'});
  f.store.set('stripe:customer:cus_same','existing-ws');
  await assert.rejects(()=>f.submit('evt_first','cs_first'),/manual reconciliation required/);
  assert.equal(f.store.get('stripe:customer:cus_same'),'existing-ws');
  assert.equal(f.store.has('user:email:customer@example.test'),false);
  assert.equal(f.store.has('stripe:event:evt_first'),false);
  assert.equal(f.locks.size,0);
  assert.equal(f.welcomes,0);
});
test('refuses conflicting Stripe customer and subscription mappings without writing a workspace',async()=>{
  const f=fixture();
  f.store.set('stripe:customer:cus_same','workspace-a');
  f.store.set('stripe:subscription:sub_same','workspace-b');
  await assert.rejects(()=>f.submit('evt_first','cs_first'),/different workspaces/);
  assert.equal(f.store.has('stripe:event:evt_first'),false);
  assert.equal(f.store.has('user:email:customer@example.test'),false);
  assert.equal(f.locks.size,0);
});
test('refuses to rewrite a member workspace when its Stripe customer mapping points elsewhere',async()=>{
  const f=fixture();
  f.store.set('user:email:customer@example.test',{workspaceId:'workspace-a',role:'owner',email:'customer@example.test'});
  f.store.set('stripe:customer:cus_same','workspace-b');
  await assert.rejects(()=>f.submit('evt_first','cs_first'),/mapping disagree/);
  assert.equal(f.store.get('user:email:customer@example.test').workspaceId,'workspace-a');
  assert.equal(f.store.get('stripe:customer:cus_same'),'workspace-b');
  assert.equal(f.store.has('stripe:event:evt_first'),false);
});

test('later checkout cannot overwrite curated existing workspace business profile',async()=>{
  const f=fixture();
  const first=await f.submit('evt_first','cs_first');
  assert.equal(first.status,200);
  const id=first.body.workspaceId,existing=f.store.get('workspace:'+id);
  existing.name='Verified business name';
  existing.ownerName='Verified owner';
  existing.contactPhone='509-555-0199';
  existing.industry='Healthcare';
  f.store.get('lead:lead-reference').business='Unverified checkout business';
  f.store.get('lead:lead-reference').name='Unknown payer';
  f.store.get('lead:lead-reference').phone='000-000-0000';
  f.store.get('lead:lead-reference').industry='Other';
  const repeat=await f.submit('evt_second','cs_second');
  assert.equal(repeat.status,200);
  const preserved=f.store.get('workspace:'+id);
  assert.equal(preserved.name,'Verified business name');
  assert.equal(preserved.ownerName,'Verified owner');
  assert.equal(preserved.contactPhone,'509-555-0199');
  assert.equal(preserved.industry,'Healthcare');
  assert.equal(preserved.stripeCheckoutSessionId,'cs_second');
});
test('disagreement between Stripe checkout email and saved lead requires reconciliation before mutation',async()=>{
  const f=fixture();
  await assert.rejects(()=>f.submit('evt_first','cs_first',{email:'other@example.test'}),/Checkout email and pre-saved lead disagree/);
  assert.equal(f.store.has('user:email:customer@example.test'),false);
  assert.equal(f.store.has('user:email:other@example.test'),false);
  assert.equal(f.store.has('stripe:event:evt_first'),false);
  assert.equal(f.locks.size,0);
  assert.equal(f.welcomes,0);
});

test('paid identity conflicts persist a bounded admin reconciliation record without customer email',async()=>{
  const f=fixture();
  f.store.set('workspace:other',{id:'other',ownerEmail:'other@example.test'});
  f.store.set('stripe:customer:cus_same','other');
  await assert.rejects(()=>f.submit('evt_conflict','cs_conflict'),/manual reconciliation required/);
  const record=f.store.get('stripe:reconciliation:cs_conflict');
  assert.equal(record.status,'open');
  assert.equal(record.reason,'workspace_owner_mismatch');
  assert.equal(record.eventId,'evt_conflict');
  assert.equal(record.sessionId,'cs_conflict');
  assert.equal(record.emailFingerprint.length,64);
  assert.ok(!JSON.stringify(record).includes('customer@example.test'));
  assert.deepEqual(f.reconciliationIndex,['cs_conflict']);
  assert.equal(f.store.has('stripe:event:evt_conflict'),false);
});
test('checkout email mismatch is visible to admin without reassigning customer',async()=>{
  const f=fixture();
  await assert.rejects(()=>f.submit('evt_mismatch','cs_mismatch',{email:'other@example.test'}),/manual reconciliation required/);
  assert.equal(f.store.get('stripe:reconciliation:cs_mismatch').reason,'email_mismatch');
  assert.equal(f.store.has('user:email:customer@example.test'),false);
  assert.equal(f.store.has('stripe:event:evt_mismatch'),false);
});
test('replayed conflict cannot fill reconciliation directory with duplicate records',async()=>{
  const f=fixture();
  f.store.set('workspace:other',{id:'other',ownerEmail:'other@example.test'});
  f.store.set('stripe:customer:cus_same','other');
  for(const id of ['evt_one','evt_two'])await assert.rejects(()=>f.submit(id,'cs_conflict'),/manual reconciliation required/);
  assert.equal(f.reconciliationIndex.length,1);
  assert.equal(f.store.get('stripe:reconciliation:cs_conflict').eventId,'evt_one');
});

test('successful retry resolves only its own previously recorded paid checkout exception',async()=>{
 const f=fixture();
 f.store.set('workspace:other',{id:'other',ownerEmail:'not-the-buyer@example.test'});
 f.store.set('stripe:customer:cus_same','other');
 await assert.rejects(()=>f.submit('evt_conflict','cs_recover'),/manual reconciliation required/);
 assert.equal(f.store.get('stripe:reconciliation:cs_recover').status,'open');
 f.store.delete('stripe:customer:cus_same');
 f.store.delete('workspace:other');
 const paid=await f.submit('evt_retry','cs_recover');
 assert.equal(paid.status,200);
 assert.equal(f.store.get('stripe:reconciliation:cs_recover').status,'resolved');
 assert.ok(f.store.get('stripe:reconciliation:cs_recover').resolvedAt>0);
 assert.equal(f.reconciliationIndex.length,1);
 assert.equal(f.store.get('stripe:event:evt_retry'),true);
});
test('a still-conflicting checkout keeps its reconciliation case open after retry',async()=>{
 const f=fixture();
 f.store.set('workspace:other',{id:'other',ownerEmail:'not-the-buyer@example.test'});
 f.store.set('stripe:customer:cus_same','other');
 for(const event of ['evt_first','evt_retry'])
   await assert.rejects(()=>f.submit(event,'cs_unresolved'),/manual reconciliation required/);
 assert.equal(f.store.get('stripe:reconciliation:cs_unresolved').status,'open');
 assert.equal(f.reconciliationIndex.length,1);
 assert.equal(f.welcomes,0);
});
