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

test('workspace deletion uses a 30-day recoverable state before purge',()=>{
  assert.match(src,/status:'pending_deletion'/);
  assert.match(src,/30\*24\*60\*60\*1000/);
  assert.match(src,/adminRestoreDeletedClient/);
  assert.match(src,/adminPurgeClient/);
  assert.match(src,/Confirmation must equal DELETE/);
  assert.match(src,/retention:workspace:/);
});

test('permanent purge cleans customer-content stores only after recovery gate',()=>{
  for(const prefix of ["'routing-request:'","'onboarding:workspace:'","'onboarding:workspace-token:'","'audit:'"])assert.ok(src.includes(prefix),prefix+' cleanup missing');
  assert.match(src,/deleteNormalizedConversations\(kv,id\)/);
  assert.match(src,/30-day recovery window has not ended/);
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

test('Stripe launch health requires the publishable key used by embedded checkout',()=>{
  assert.match(src,/process\.env\.STRIPE_SECRET_KEY&&process\.env\.STRIPE_PUBLISHABLE_KEY&&process\.env\.STRIPE_WEBHOOK_SECRET/);
  assert.match(src,/STRIPE_PUBLISHABLE_KEY missing/);
});

test('Stripe health validates live webhook event coverage and Customer Portal configuration',()=>{
  assert.match(src,/async function stripeConfigurationHealth\(\)/);
  for(const event of ['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.payment_failed','invoice.paid']){
    assert.ok(src.includes("'"+event+"'"),'missing Stripe health event '+event);
  }
  assert.match(src,/\/v1\/webhook_endpoints\?limit=100/);
  assert.match(src,/\/v1\/billing_portal\/configurations\?active=true&limit=10/);
  assert.match(src,/missingEvents/);
  assert.match(src,/Stripe Customer Portal has no active configuration/);
});

test('production readiness requires checkout plus owner-confirmed launch gates',()=>{
  assert.match(src,/CALLERCORE_CHECKOUT_ENABLED==='true'/);
  assert.match(src,/LAUNCH_GATE_DEFS/);
  for(const key of ['previewIsolation','disposableE2E','voiceLifecycle','productionEnvScope','supportEmail','businessTax','legalReview']){
    assert.ok(src.includes("key:'"+key+"'"),'missing launch gate '+key);
  }
  assert.match(src,/\.\.\.LAUNCH_GATE_DEFS\.map\(g=>'gate-'\+g\.key\)/);
  assert.match(src,/\['operational','configured','confirmed'\]/);
});

test('privacy purge preserves policy-required support and audit archives separately',()=>{
  assert.match(src,/retention:support:/);
  assert.match(src,/retention:audit:/);
  assert.match(src,/365\*2/);
  assert.match(src,/retention:workspace:/);
  assert.match(src,/365\*7/);
});

test('platform settings persist launch confirmations without dropping existing gates',()=>{
  assert.match(src,/launchGateState\(saved\.launchGates\)/);
  assert.match(src,/body\.launchGates&&typeof body\.launchGates==='object'\?launchGateState\(body\.launchGates\):launchGateState\(previous\.launchGates\)/);
  assert.match(src,/status:launchGates\[g\.key\]\?'confirmed':'pending'/);
});

test('system health detects dangerous production and preview environment scoping',()=>{
  assert.match(src,/function environmentScopeHealth\(\)/);
  assert.match(src,/Preview is using live Stripe credentials/);
  assert.match(src,/Preview checkout launch gate is enabled/);
  assert.match(src,/Preview bootstrap secret is present in Production/);
  assert.match(src,/key:'environment-scope'/);
  assert.match(src,/requiredForLaunch=\['database','environment-scope','data-integrity','checkout'/);
});

test('workspace recovery drill validates export structure without writing customer data',()=>{
  assert.match(src,/function validateWorkspaceExportData\(data\)/);
  assert.match(src,/Potential unredacted secret fields/);
  assert.match(src,/requiresProviderReconnect/);
  assert.match(src,/async function adminRecoveryDrill\(req,res\)/);
  assert.match(src,/action:'recovery_drill'/);
  const start=src.indexOf('async function adminRecoveryDrill');
  const end=src.indexOf('\nasync function ',start+1);
  const body=src.slice(start,end>=0?end:src.length);
  assert.doesNotMatch(body,/kv\.set\(/);
  assert.doesNotMatch(body,/kv\.del\(/);
});

test('usage notifications warn at 70 85 and 100 percent without implying charges',()=>{
  assert.match(src,/pct>=100\?100:pct>=85\?85:pct>=70\?70:0/);
  assert.match(src,/This notice does not by itself mean an overage charge has been applied/);
  assert.match(src,/admin-usage:/);
  assert.match(src,/no overage policy is implied by this notice/);
});

test('launch-gate changes are recorded in the atomic platform settings audit event',()=>{
  const start=src.indexOf('async function adminPlatformSettingsSave('),end=src.indexOf('\nasync function validatedGmailFrom(',start);
  assert.ok(start>=0&&end>start);
  const handler=src.slice(start,end);
  assert.match(handler,/changedGates/);
  assert.match(handler,/launchGates:launchGateState\(previous\.launchGates\)/);
  assert.match(handler,/maintenanceMode:settings\.maintenanceMode,launchGates/);
  assert.match(handler,/meta:\{changedGates\}/);
  assert.match(handler,/compareAndAudit\(kv,\{key:'platform:settings',before:saved,after:settings\},'audit:'\+admin\.workspaceId,audit\)/);
  assert.doesNotMatch(handler,/kv\.set\('platform:settings'/);
});


test('phone routing rejects duplicate numbers and duplicate workspace assignments',()=>{
  const start=src.indexOf('async function adminSavePhoneNumber');
  assert.ok(start>=0,'adminSavePhoneNumber missing');
  const end=src.indexOf('\nasync function ',start+1);
  const body=src.slice(start,end>=0?end:src.length);
  assert.match(body,/duplicateNumber/);
  assert.match(body,/duplicateWorkspace/);
  assert.match(body,/already in the routing inventory/);
  assert.match(body,/already has a CallerCore number/);
  assert.match(body,/phone_routing_update/);
});


test('launch checklist cannot invent review, testing, or client approval',()=>{
  const start=src.indexOf('async function adminProvisioningChecklistSave');
  const end=src.indexOf('\nasync function ',start+1);
  const body=src.slice(start,end>=0?end:src.length);
  assert.match(body,/const required=\['agreement','intake','adminReview','testCall','clientApproval'\]/);
  assert.match(body,/missing\.length\)return res\.status\(409\)/);
  assert.match(body,/phone\.status==='active'/);
  assert.doesNotMatch(body,/next\.checklist\.adminReview=true/);
  assert.doesNotMatch(body,/next\.checklist\.testCall=true/);
  assert.doesNotMatch(body,/next\.checklist\.clientApproval=true/);
});
test('manual stage label cannot bypass verified client launch',()=>{
  const start=src.indexOf('async function adminSaveProvisioningStage');
  const end=src.indexOf('\nasync function ',start+1);
  const body=src.slice(start,end>=0?end:src.length);
  assert.match(body,/if\(stage==='Live'\)/);
  assert.match(body,/canManuallyMarkLive\(\{workspace:ws,onboarding\}\)/);
});
test('onboarding status persists before email notification and warns on delivery failure',()=>{
  const start=src.indexOf('async function adminProvisioningChecklistSave');
  const end=src.indexOf('\nasync function ',start+1);
  const body=src.slice(start,end>=0?end:src.length);
  assert.ok(body.indexOf('await kv.set(key,next);')<body.indexOf('try{await sendMail(mailNotification)}'));
  assert.match(body,/warning='The setup status was saved/);
  assert.match(body,/onboarding_email_failed/);
});
