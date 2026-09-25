const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const account=fs.readFileSync('api/account.js','utf8'),checkout=fs.readFileSync('api/create-checkout-session.js','utf8');

function environmentHealth(env={}){
  const context=vm.createContext({process:{env:{...env}}}),start=account.indexOf('function environmentScopeHealth('),end=account.indexOf('\nasync function adminSystemHealth',start);
  vm.runInContext(account.slice(start,end),context);return vm.runInContext('environmentScopeHealth()',context);
}

test('environment health rejects live Preview, test Production and mixed Stripe modes',()=>{
  const preview=environmentHealth({VERCEL_ENV:'preview',STRIPE_SECRET_KEY:'sk_live_example',STRIPE_PUBLISHABLE_KEY:'pk_live_example'});
  assert.equal(preview.ok,false);assert.ok(Array.from(preview.issues).some(issue=>/Preview is using live/.test(issue)));
  const production=environmentHealth({VERCEL_ENV:'production',STRIPE_SECRET_KEY:'sk_test_example',STRIPE_PUBLISHABLE_KEY:'pk_test_example'});
  assert.equal(production.ok,false);assert.ok(Array.from(production.issues).some(issue=>/Production is using Stripe test/.test(issue)));
  const mixed=environmentHealth({VERCEL_ENV:'development',STRIPE_SECRET_KEY:'sk_test_example',STRIPE_PUBLISHABLE_KEY:'pk_live_example'});
  assert.equal(mixed.ok,false);assert.ok(Array.from(mixed.issues).some(issue=>/modes do not match/.test(issue)));
});

test('matching Stripe modes pass scope checks only in their intended environment',()=>{
  const preview={VERCEL_ENV:'preview',STRIPE_SECRET_KEY:'sk_test_example',STRIPE_PUBLISHABLE_KEY:'pk_test_example',STRIPE_STARTER_PRICE_ID:'price_test_starter',STRIPE_GROWTH_PRICE_ID:'price_test_growth',STRIPE_PRO_PRICE_ID:'price_test_pro',STRIPE_SETUP_PRICE_ID:'price_test_setup'};
  assert.equal(environmentHealth(preview).ok,true);
  assert.equal(environmentHealth({VERCEL_ENV:'production',STRIPE_SECRET_KEY:'sk_live_example',STRIPE_PUBLISHABLE_KEY:'pk_live_example'}).ok,true);
});

test('Preview test credentials require an explicit isolated Price catalog',()=>{
  const result=environmentHealth({VERCEL_ENV:'preview',STRIPE_SECRET_KEY:'sk_test_example',STRIPE_PUBLISHABLE_KEY:'pk_test_example'});
  assert.equal(result.ok,false);assert.ok(Array.from(result.issues).some(issue=>/explicit test Price IDs/.test(issue)));
});

test('checkout rejects invalid environment modes before starting a Stripe request',()=>{
  assert.match(checkout,/function stripeCredentialModesValid\(\)/);
  assert.match(checkout,/env==='preview'.*secretMode==='live'/s);
  assert.match(checkout,/env==='production'.*secretMode==='test'/s);
  assert.match(checkout,/secretMode!==publishableMode/);
  const gate=checkout.indexOf("if(!stripeCredentialModesValid())"),request=checkout.indexOf("const rl=await rateLimit");
  assert.ok(gate>0&&gate<request);
});

test('Stripe health and Billing Portal refuse environment-mode failures before provider calls',()=>{
  const healthStart=account.indexOf('async function stripeConfigurationHealth()'),healthFetch=account.indexOf("fetch('https://api.stripe.com/v1/webhook_endpoints",healthStart),healthGate=account.indexOf('environmentScopeHealth().issues.find',healthStart);
  assert.ok(healthGate>healthStart&&healthGate<healthFetch);
  const portalStart=account.indexOf('async function billingPortal('),portalFetch=account.indexOf("fetch('https://api.stripe.com/v1/billing_portal/sessions",portalStart),portalGate=account.indexOf('environmentScopeHealth().issues.find',portalStart);
  assert.ok(portalGate>portalStart&&portalGate<portalFetch);assert.match(account.slice(portalStart,portalFetch),/Stripe billing credentials do not match this environment/);
});
