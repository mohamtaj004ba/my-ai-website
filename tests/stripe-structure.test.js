const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');
const account=fs.readFileSync(path.join(__dirname,'..','api','account.js'),'utf8');

test('Stripe event idempotency key is declared before lifecycle branches',()=>{
  const declaration=src.indexOf("const eventKey=event.id?'stripe:event:'+event.id:null");
  const lifecycle=src.indexOf("if(lifecycleEvent)");
  const checkout=src.indexOf("const session=event.data&&event.data.object");
  assert.ok(declaration>=0,'eventKey declaration missing');
  assert.ok(lifecycle>declaration,'lifecycle branch must come after eventKey declaration');
  assert.ok(checkout>declaration,'checkout branch must come after eventKey declaration');
});

test('Stripe webhook checks duplicate event ids before side effects',()=>{
  const declaration=src.indexOf("const eventKey=event.id?'stripe:event:'+event.id:null");
  const duplicate=src.indexOf("if(eventKey&&await kv.get(eventKey))",declaration);
  const lifecycle=src.indexOf("if(lifecycleEvent)");
  assert.ok(duplicate>declaration&&duplicate<lifecycle,'duplicate check must happen before lifecycle side effects');
});

test('Stripe webhook still verifies signatures before parsing events',()=>{
  const verify=src.indexOf("verifyStripeSignature");
  const parse=src.indexOf("JSON.parse(rawBody)");
  assert.ok(verify>=0&&parse>verify);
});

test('embedded checkout uses verified CallerCore prices and preserves lead tracking',()=>{
  const checkout=fs.readFileSync(path.join(__dirname,'..','api','create-checkout-session.js'),'utf8');
  assert.match(checkout,/price_1To98LF0BXlPng7V4YXh69Yc/);
  assert.match(checkout,/price_1To9D3F0BXlPng7VH3Ye2OzZ/);
  assert.match(checkout,/price_1To9G4F0BXlPng7VkvMGPE2Y/);
  assert.match(checkout,/price_1To9HhF0BXlPng7V0OBFPmQR/);
  assert.match(checkout,/params\.set\('ui_mode','embedded_page'\)/);
  assert.match(checkout,/params\.set\('client_reference_id',leadId\)/);
  assert.match(checkout,/upsertWebsiteProspect/);
  assert.match(checkout,/recordSiteEvent/);
});

test('Stripe webhook accepts embedded checkout plan metadata as well as legacy payment links',()=>{
  assert.match(src,/const metadataPlan=String\(session\.metadata\?\.plan\|\|''\)/);
  assert.match(src,/PLAN_BY_PAYMENT_LINK\[session\.payment_link\]\|\|\(\['Starter','Growth','Pro'\]\.includes\(metadataPlan\)\?metadataPlan:null\)/);
});

test('get-started mounts Stripe Embedded Checkout instead of redirecting to Payment Links',()=>{
  const page=fs.readFileSync(path.join(__dirname,'..','get-started.html'),'utf8');
  assert.match(page,/https:\/\/js\.stripe\.com\/v3\//);
  assert.match(page,/fetch\('\/api\/create-checkout-session'/);
  assert.match(page,/initEmbeddedCheckout/);
  assert.doesNotMatch(page,/buy\.stripe\.com/);
});

test('checkout completion page distinguishes confirmed and pending payments',()=>{
  const page=fs.readFileSync(path.join(__dirname,'..','checkout-complete.html'),'utf8');
  assert.match(page,/data\.status==='complete'&&\['paid','no_payment_required'\]\.includes\(data\.paymentStatus\)/);
  assert.match(page,/Your payment is processing\./);
  assert.match(page,/Do not submit another payment\./);
});

test('embedded checkout is closed unless the explicit sales launch flag is enabled',()=>{
  const checkout=fs.readFileSync(path.join(__dirname,'..','api','create-checkout-session.js'),'utf8');
  assert.match(checkout,/process\.env\.CALLERCORE_CHECKOUT_ENABLED!=='true'/);
  assert.match(checkout,/CallerCore checkout is not open yet/);
});

test('Stripe lifecycle metrics are recorded before workspace mapping can discard a real billing failure',()=>{
  const lifecycle=src.indexOf("if(lifecycleEvent)");
  const coverage=src.indexOf("await ensureStripeMonthlyMetricsCoverage",lifecycle);
  const failureMetric=src.indexOf("await recordStripePaymentFailure",lifecycle);
  const workspaceLookup=src.indexOf("const [subscriptionWorkspace,customerWorkspace]=await Promise.all",lifecycle);
  assert.ok(coverage>lifecycle&&coverage<workspaceLookup,'coverage start must be established before workspace mapping');
  assert.ok(failureMetric>coverage&&failureMetric<workspaceLookup,'payment failure must be counted before mapping can return unmapped');
  assert.match(src,/Stripe billing metrics could not be confirmed\. Retry the webhook event\./);
});

test('Stripe monthly metric receipts hash provider event ids instead of storing raw ids in receipt keys',()=>{
  const metrics=fs.readFileSync(path.join(__dirname,'..','lib','stripe-monthly-metrics.js'),'utf8');
  assert.match(metrics,/createHash\('sha256'\)\.update\(id\)\.digest\('hex'\)/);
  assert.doesNotMatch(metrics,/stripe:metric-event:'\+id/);
  assert.match(metrics,/STRIPE_METRIC_RECEIPT_SECONDS=2\*365\*24\*60\*60/);
});



test('billing portal refuses mismatched workspace identity and unverified redirect URLs',()=>{
  const start=account.indexOf('async function billingPortal('),end=account.indexOf('\nasync function logout(',start);
  assert.ok(start>=0&&end>start);
  const body=account.slice(start,end);
  assert.match(body,/String\(ws\.id\|\|''\)!==String\(s\.workspaceId\)/);
  assert.match(body,/Workspace billing identity is unavailable/);
  assert.match(body,/portalUrl\.protocol!=='https:'/);
  assert.match(body,/portalUrl\.hostname!=='billing\.stripe\.com'/);
  assert.match(body,/Could not create a verified Stripe billing portal session/);
});


test('embedded checkout verifies canonical Stripe session responses before reporting status or client secret',()=>{
  const checkout=fs.readFileSync(path.join(__dirname,'..','api','create-checkout-session.js'),'utf8');
  assert.match(checkout,/if\(!data\|\|typeof data!=='object'\|\|Array\.isArray\(data\)\)throw new Error\('Stripe response could not be verified'\)/);
  assert.match(checkout,/session\.object!=='checkout\.session'\|\|String\(session\.id\|\|''\)!==sessionId/);
  assert.match(checkout,/\['open','complete','expired'\]\.includes\(String\(session\.status\|\|''\)\)/);
  assert.match(checkout,/\['paid','unpaid','no_payment_required'\]\.includes\(String\(session\.payment_status\|\|''\)\)/);
  assert.match(checkout,/\^cs_\(\?:live\|test\)_\[A-Za-z0-9_\]\+\$/);
  assert.match(checkout,/clientSecret\.startsWith\(sessionId\+'_secret_'\)/);
  assert.match(checkout,/Stripe checkout creation response could not be verified/);
});


test('embedded checkout fails closed on malformed account mapping, prospect identity, or unconfirmed lead persistence',()=>{
  const checkout=fs.readFileSync(path.join(__dirname,'..','api','create-checkout-session.js'),'utf8');
  assert.match(checkout,/existingMember!=null&&\(!existingMember\|\|typeof existingMember!=='object'\|\|Array\.isArray\(existingMember\)\)/);
  assert.match(checkout,/checkout prospect identity could not be verified/);
  assert.match(checkout,/String\(prospect\.email\|\|''\)\.toLowerCase\(\)!==email/);
  assert.match(checkout,/const confirmedLead=await kv\.get\(leadKey\)/);
  assert.match(checkout,/checkout lead persistence could not be confirmed/);
  assert.match(checkout,/String\(confirmedLead\.prospectId\|\|''\)!==String\(prospect\.id\)/);
});


test('embedded checkout binds the returned Stripe session to the expected lead, prospect, plan, and customer',()=>{
  const checkout=fs.readFileSync(path.join(__dirname,'..','api','create-checkout-session.js'),'utf8');
  assert.match(checkout,/clientSecret\.startsWith\(sessionId\+'_secret_'\)/);
  assert.match(checkout,/String\(session\.client_reference_id\|\|''\)!==leadId/);
  assert.match(checkout,/String\(session\.customer_email\|\|session\.customer_details\?\.email\|\|''\)\.toLowerCase\(\)!==email/);
  assert.match(checkout,/String\(session\.metadata\?\.plan\|\|''\)!==plan/);
  assert.match(checkout,/String\(session\.metadata\?\.prospect_id\|\|''\)!==String\(prospect\.id\)/);
});


test('Stripe configuration health rejects malformed successful provider payloads',()=>{
  const start=account.indexOf('async function stripeConfigurationHealth('),end=account.indexOf('\nfunction environmentScopeHealth(',start);
  assert.ok(start>=0&&end>start);
  const body=account.slice(start,end);
  assert.match(body,/whRes\.json\(\)\.catch\(\(\)=>null\)/);
  assert.match(body,/!wh\|\|typeof wh!=='object'\|\|Array\.isArray\(wh\)\|\|!Array\.isArray\(wh\.data\)/);
  assert.match(body,/!portalData\|\|typeof portalData!=='object'\|\|Array\.isArray\(portalData\)\|\|!Array\.isArray\(portalData\.data\)/);
  assert.match(body,/Stripe configuration response could not be verified/);
});


test('Stripe webhook provisioning rejects malformed account, workspace, and onboarding state',()=>{
  const webhook=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');
  assert.match(webhook,/existingMember!=null&&\(!existingMember\|\|typeof existingMember!=='object'\|\|Array\.isArray\(existingMember\)\)/);
  assert.match(webhook,/existingMember\?\.email&&String\(existingMember\.email\)\.trim\(\)\.toLowerCase\(\)!==email/);
  assert.match(webhook,/rawExisting!=null&&\(!rawExisting\|\|typeof rawExisting!=='object'\|\|Array\.isArray\(rawExisting\)\)/);
  assert.match(webhook,/String\(existing\.id\)!==String\(workspaceId\)/);
  assert.match(webhook,/rawExistingOnboarding!=null&&\(!rawExistingOnboarding\|\|typeof rawExistingOnboarding!=='object'\|\|Array\.isArray\(rawExistingOnboarding\)\)/);
  assert.match(webhook,/Existing onboarding workspace identity disagrees/);
});


test('Stripe webhook validates lifecycle and checkout payload shape plus mapped workspace identity',()=>{
  const webhook=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');
  assert.match(webhook,/Invalid Stripe lifecycle payload/);
  assert.match(webhook,/ws==null/);
  assert.match(webhook,/typeof ws!=='object'\|\|Array\.isArray\(ws\)\|\|String\(ws\.id\|\|''\)!==String\(workspaceId\)/);
  assert.match(webhook,/Mapped workspace state could not be verified/);
  assert.match(webhook,/Invalid checkout session payload/);
});


test('Stripe webhook only acknowledges processed events after receipt persistence readback',()=>{
  const webhook=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');
  assert.match(webhook,/async function markStripeEventProcessed\(eventKey\)/);
  assert.match(webhook,/const confirmed=await kv\.get\(eventKey\)/);
  assert.match(webhook,/Stripe event receipt persistence could not be confirmed/);
  assert.doesNotMatch(webhook,/if\(eventKey\)await kv\.set\(eventKey,true/);
  assert.match(webhook,/if\(eventKey\)await markStripeEventProcessed\(eventKey\)/);
});


test('Stripe checkout provisioning rejects malformed durable receipt and onboarding records',()=>{
  const webhook=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');
  assert.match(webhook,/function validCheckoutSessionState\(value,sessionId\)/);
  assert.match(webhook,/Checkout session receipt is malformed/);
  assert.match(webhook,/Checkout session receipt became malformed during provisioning/);
  assert.match(webhook,/Linked onboarding record is malformed/);
  assert.match(webhook,/Onboarding record is malformed/);
  assert.match(webhook,/Onboarding workspace identity disagrees/);
});


test('Stripe checkout account provisioning validates mapping shape and confirms all identity writes',()=>{
  const webhook=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');
  assert.match(webhook,/typeof mapping!=='string'\|\|!mapping\.trim\(\)/);
  assert.match(webhook,/Checkout account persistence could not be confirmed/);
  assert.match(webhook,/const \[confirmedWorkspace,confirmedMember,confirmedCustomer,confirmedSubscription\]=await Promise\.all/);
  assert.match(webhook,/String\(confirmedWorkspace\.ownerEmail\|\|''\)\.trim\(\)\.toLowerCase\(\)!==email/);
  assert.match(webhook,/String\(confirmedMember\.workspaceId\|\|''\)!==String\(workspaceId\)/);
  assert.match(webhook,/session\.customer&&String\(confirmedCustomer\|\|''\)!==String\(workspaceId\)/);
});


test('Stripe lifecycle events are not acknowledged before workspace and subscription persistence are verified',()=>{
  const webhook=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');
  assert.match(webhook,/const \[confirmedLifecycleWorkspace,confirmedSubscriptionMapping\]=await Promise\.all/);
  assert.match(webhook,/String\(confirmedLifecycleWorkspace\.subscriptionStatus\|\|''\)!==String\(status\)/);
  assert.match(webhook,/Stripe lifecycle persistence could not be confirmed/);
  assert.match(webhook,/subscriptionId&&String\(confirmedSubscriptionMapping\|\|''\)!==String\(workspaceId\)/);
});


test('Stripe lifecycle processing rejects malformed or conflicting customer/subscription mappings',()=>{
  const webhook=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');
  assert.match(webhook,/const \[subscriptionWorkspace,customerWorkspace\]=await Promise\.all/);
  assert.match(webhook,/Stripe lifecycle mapping is malformed/);
  assert.match(webhook,/subscriptionWorkspace&&customerWorkspace&&String\(subscriptionWorkspace\)!==String\(customerWorkspace\)/);
  assert.match(webhook,/Stripe customer and subscription mappings disagree/);
});


test('Stripe checkout validates durable token identifiers and stored lead record shape',()=>{
  const webhook=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');
  assert.match(webhook,/value\.token&&!\/\^\[a-f0-9\]\{48\}\$\/i\.test\(String\(value\.token\)\)/);
  assert.match(webhook,/Persisted onboarding lead is malformed/);
  assert.match(webhook,/Persisted checkout lead is malformed/);
  assert.match(webhook,/else lead=\{\.\.\.lead\}/);
});


test('Stripe provisioning rejects malformed nested workspace acquisition, conversion, usage, or billing state',()=>{
  const webhook=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');
  assert.match(webhook,/\[['"]acquisition['"],existing\.acquisition\].*\[['"]conversion['"],existing\.conversion\].*\[['"]usage['"],existing\.usage\].*\[['"]stripeBilling['"],existing\.stripeBilling\]/s);
  assert.match(webhook,/Existing workspace ['"]?\+field\+['"]? state is malformed|Existing workspace '\+field\+' state is malformed/);
  assert.match(webhook,/ws\.stripeBilling!=null&&\(!ws\.stripeBilling\|\|typeof ws\.stripeBilling!=='object'\|\|Array\.isArray\(ws\.stripeBilling\)\)/);
  assert.match(webhook,/Workspace billing state could not be verified/);
});


test('Stripe checkout verifies onboarding token, workspace state, and durable session receipt before welcome flow',()=>{
  const webhook=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');
  assert.match(webhook,/status:'awaiting_review',sessionId:session\.id/);
  assert.match(webhook,/const \[confirmedOnboarding,confirmedWorkspaceToken,confirmedOnboardingState,confirmedSessionState\]=await Promise\.all/);
  assert.match(webhook,/String\(confirmedOnboarding\.workspaceId\|\|''\)!==String\(workspace\.id\)/);
  assert.match(webhook,/String\(confirmedWorkspaceToken\|\|''\)!==String\(token\)/);
  assert.match(webhook,/Checkout onboarding persistence could not be confirmed/);
});


test('Stripe checkout final receipt preserves provider session identity and is verified before event acknowledgement',()=>{
  const webhook=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');
  assert.match(webhook,/const finalSessionState=await kv\.get\(sessionKey\)/);
  assert.match(webhook,/Final checkout session receipt could not be confirmed/);
  const finalAt=webhook.indexOf('const finalSessionState=await kv.get(sessionKey)');
  const ackAt=webhook.indexOf('if(eventKey)await markStripeEventProcessed(eventKey)',finalAt);
  assert.ok(finalAt>=0&&ackAt>finalAt);
});
