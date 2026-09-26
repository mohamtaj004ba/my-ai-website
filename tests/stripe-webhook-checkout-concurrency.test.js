const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {PassThrough}=require('node:stream');
const sessionLock=require('../lib/stripe-session-lock');
const source=fs.readFileSync('api/stripe-webhook.js','utf8');
function deferred(){
  let resolve;
  const promise=new Promise(r=>{resolve=r});
  return {promise,resolve};
}
function fixture({blockFirstWorkspace=false,failFirstWorkspace=false}={}){
  const store=new Map(),locks=new Map(),entered=deferred(),resume=deferred();
  let welcomes=0,workspaces=0,telemetry=0,failed=false;
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
      throw Error('Unexpected script');
    }
  };
  const modules={
    crypto,'../lib/kv':{kv},
    '../lib/mail':{sendMail:async()=>{welcomes++}},
    '../lib/safe-log':{safeError:()=> 'redacted'},
    '../lib/email-template':{lifecycleEmail:()=>({text:'Thanks',html:'Thanks'})},
    '../lib/plans':{normalizePlan:p=>p,entitlementsFor:p=>({plan:p,price:999})},
    '../lib/site-analytics':{
      recordSiteEvent:async()=>{telemetry++},
      upsertWebsiteProspect:async()=>({id:'p-1'})
    },
    '../lib/business-hours':{addBusinessHours:n=>n+7200000},
    '../lib/stripe-lifecycle':{lifecycleDecision:()=>({apply:false})},
    '../lib/stripe-session-lock':sessionLock
  };
  const module={exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,require:name=>{
    if(!(name in modules))throw Error('Unexpected module '+name);
    return modules[name]
  },process:{env:{STRIPE_WEBHOOK_SECRET:'test-webhook-secret',SITE_URL:'https://callercore.com'}},
  Buffer,Date,Math,Number,String,Object,Array,Promise,Set,console:{error(){}},URL});
  const handler=module.exports;
  async function submit(eventId){
    const event={id:eventId,type:'checkout.session.completed',data:{object:{
      id:'cs_same',payment_status:'paid',client_reference_id:'lead-reference',
      customer:'cus_same',subscription:'sub_same',metadata:{plan:'Pro'},
      customer_details:{email:'customer@example.test',name:'Customer'}
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
  return {submit,entered,resume,store,locks,get welcomes(){return welcomes},get workspaces(){return workspaces},get telemetry(){return telemetry}};
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
