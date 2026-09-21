const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','api','account.js'),'utf8');

test('raw workspace override protects owner email and CallerCore phone',()=>{
  assert.match(src,/Owner email is protected\. Use Repair access mapping instead\./);
  assert.match(src,/CallerCore phone assignment is protected\. Use Phone Numbers instead\./);
  assert.match(src,/safe\.ownerEmail=current\.ownerEmail/);
  assert.match(src,/safe\.phone=current\.phone/);
});

test('raw workspace override cannot bypass Stripe-managed plan',()=>{
  assert.match(src,/Plan is managed by Stripe for this workspace\./);
  assert.match(src,/current\.stripeSubscriptionId/);
});

test('workspace deletion cleans onboarding routing and audit records',()=>{
  for(const prefix of ["'routing-request:'","'onboarding:workspace:'","'onboarding:workspace-token:'","'audit:'"])assert.ok(src.includes(prefix),prefix+' cleanup missing');
});

test('admin client view remains read-only and client mutations require writable sessions',()=>{
  assert.match(src,/createSession\(res,\{email:admin\.email,workspaceId:id,role:'admin',adminView:true/);
  assert.match(src,/if\(s\.adminView\)return res\.status\(403\)\.json\(\{error:'Admin client view is read-only'\}\),null/);
  const writes=['saveLocations','saveAgent','saveAutomations','updateAppointment','saveSettings','saveIntegrations','updateLead','createSupportTicket','replySupportTicket','billingPortal'];
  for(const name of writes){
    const start=src.indexOf('async function '+name+'(');
    assert.ok(start>=0,name+' handler missing');
    const next=src.indexOf('\nasync function ',start+1);
    const body=src.slice(start,next>=0?next:src.length);
    assert.match(body,/requireWritableSession\(req,res\)/,name+' must reject read-only admin client view');
  }
});
