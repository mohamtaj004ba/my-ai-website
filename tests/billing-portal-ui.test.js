const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const ui=fs.readFileSync('dashboard.js','utf8');
const start=ui.indexOf("async function openBillingPortal(button,label='Opening…'){");
const end=ui.indexOf("\ndocument.getElementById('paymentButton')",start);
assert.ok(start>=0&&end>start,'openBillingPortal must exist');
const fn=ui.slice(start,end);

function fixture({response,networkError=false}={}){
  const alerts=[],location={href:''},button={disabled:false,textContent:'Manage billing',dataset:{original:'Manage billing & invoices'},isConnected:true};
  const ctx=vm.createContext({
    fetch:async()=>{if(networkError)throw Error('offline');return response},
    alert:x=>alerts.push(String(x)),
    location,URL,String,Error
  });
  vm.runInContext(fn,ctx);
  return {button,alerts,location,run:()=>vm.runInContext("openBillingPortal(button)",vm.createContext({...ctx,button}))};
}

test('Billing Portal opens only a canonical Stripe billing URL',async()=>{
  const button={disabled:false,textContent:'Manage billing',dataset:{original:'Manage billing & invoices'},isConnected:true};
  const alerts=[],location={href:''};
  const ctx=vm.createContext({
    button,fetch:async()=>({ok:true,json:async()=>({url:'https://billing.stripe.com/p/session/test'})}),
    alert:x=>alerts.push(String(x)),location,URL,String,Error
  });
  vm.runInContext(fn,ctx);
  assert.equal(await vm.runInContext('openBillingPortal(button)',ctx),true);
  assert.equal(location.href,'https://billing.stripe.com/p/session/test');
  assert.equal(button.disabled,true);
  assert.deepEqual(alerts,[]);
});

test('Billing Portal rejects an unexpected successful URL and restores the button',async()=>{
  const button={disabled:false,textContent:'Manage billing',dataset:{original:'Manage billing & invoices'},isConnected:true};
  const alerts=[],location={href:''};
  const ctx=vm.createContext({
    button,fetch:async()=>({ok:true,json:async()=>({url:'https://example.test/fake'})}),
    alert:x=>alerts.push(String(x)),location,URL,String,Error
  });
  vm.runInContext(fn,ctx);
  assert.equal(await vm.runInContext('openBillingPortal(button)',ctx),false);
  assert.equal(location.href,'');
  assert.equal(button.disabled,false);
  assert.equal(button.textContent,'Manage billing & invoices');
  assert.match(alerts[0],/Billing portal is unavailable/);
});

test('Billing Portal network failure restores the initiating button',async()=>{
  const button={disabled:false,textContent:'Continue to Stripe',dataset:{original:'Continue to Stripe'},isConnected:true};
  const alerts=[],location={href:''};
  const ctx=vm.createContext({
    button,fetch:async()=>{throw Error('offline')},
    alert:x=>alerts.push(String(x)),location,URL,String,Error
  });
  vm.runInContext(fn,ctx);
  assert.equal(await vm.runInContext("openBillingPortal(button,'Opening Stripe…')",ctx),false);
  assert.equal(button.disabled,false);
  assert.equal(button.textContent,'Continue to Stripe');
  assert.deepEqual(alerts,['offline']);
});


test('subscription support requests block duplicate submits and verify the returned ticket',()=>{
  const start=ui.indexOf('async function requestRetention(kind){'),end=ui.indexOf("\nretentionModal?.querySelectorAll('[data-retention]')",start),block=ui.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(block,/if\(retentionRequestPending\)return false/);
  assert.match(block,/setRetentionPending\(true\)/);
  assert.match(block,/data\.ok!==true/);
  assert.match(block,/String\(ticket\.subject\|\|'\'\)!==subject/);
  assert.match(block,/finally\{setRetentionPending\(false\)\}/);
  assert.match(ui,/function closeRetention\(\)\{if\(retentionRequestPending\)return false/);
});

test('second subscription support request is ignored while the first is pending',async()=>{
  const start=ui.indexOf('async function requestRetention(kind){'),end=ui.indexOf("\nretentionModal?.querySelectorAll('[data-retention]')",start),block=ui.slice(start,end);
  let release,requests=0;const status={textContent:''};
  const ctx=vm.createContext({
    retentionRequestPending:false,
    setRetentionPending(value){this.retentionRequestPending=!!value;ctx.retentionRequestPending=!!value},
    document:{getElementById:id=>id==='retentionStatus'?status:null},
    fetch:async()=>{requests++;await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>({ok:true,ticket:{id:'ticket-1',subject:'Subscription pause request'}})}},
    String,Object,Array,Promise,Error
  });
  vm.runInContext(block,ctx);
  const first=vm.runInContext("requestRetention('pause')",ctx);
  await new Promise(resolve=>setImmediate(resolve));
  const second=await vm.runInContext("requestRetention('pause')",ctx);
  assert.equal(second,false);assert.equal(requests,1);
  release();assert.equal(await first,true);
  assert.equal(ctx.retentionRequestPending,false);
});
