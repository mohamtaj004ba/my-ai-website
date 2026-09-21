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

test('public health can report KV failure without requiring an authenticated session',()=>{
  assert.match(src,/async function publicHealth\(req,res\)/);
  assert.match(src,/const db=await kvHealthCheck\(\)/);
  assert.match(src,/return res\.status\(db\.ok\?200:503\)\.json/);
  const healthRoute=src.indexOf("if(action==='health'&&req.method==='GET')return publicHealth(req,res);");
  const bootstrapRoute=src.indexOf("if(action==='bootstrap-preview'");
  assert.ok(healthRoute>=0&&bootstrapRoute>healthRoute,'health route should be handled before authenticated/admin routes');
});

test('KV health checks are bounded and do not leak raw infrastructure errors',()=>{
  assert.match(src,/Promise\.race\(/);
  assert.match(src,/KV health check timed out/);
  assert.match(src,/error=\/ENOTFOUND\|getaddrinfo\/i\.test\(raw\)\?'dns':\/timed out\/i\.test\(raw\)\?'timeout':'unavailable'/);
  assert.doesNotMatch(src,/publicHealth[\s\S]{0,600}raw/);
});
