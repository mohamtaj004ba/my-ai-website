const test=require('node:test'),assert=require('node:assert/strict');
const {providerConfig,createProvider,canonicalBilling,subscriptionRevision,safeDocument,paymentSummary,validateContact}=require('../lib/billing-provider');
const {prepareChange,applyChange,setupPayment,confirmPayment}=require('../lib/billing-actions');
const {synchronizeBillingEvent}=require('../lib/billing-webhook');
const env={VERCEL_ENV:'preview',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_PRICE_STARTER:'price_starter',STRIPE_PRICE_GROWTH:'price_growth',STRIPE_PRICE_PRO:'price_pro',STRIPE_PUBLISHABLE_KEY:'pk_test_fixture'};
function fixture(){
  const records=new Map([['workspace:w',{id:'w',ownerEmail:'client@example.test',plan:'Starter',stripeCustomerId:'cus_own',stripeSubscriptionId:'sub_own',usage:{minutes:260}}],['stripe:customer:cus_own','w'],['stripe:subscription:sub_own','w']]);
  const customer={id:'cus_own',email:'client@example.test',name:'Client',address:{},invoice_settings:{}};
  const subscription={id:'sub_own',customer:'cus_own',status:'active',cancel_at_period_end:false,items:{data:[{id:'si_own',quantity:1,current_period_end:1900000000,price:{id:'price_starter',currency:'usd',unit_amount:34900,recurring:{interval:'month',usage_type:'licensed'}}}]}};
  const calls=[];
  const provider={config:providerConfig(env),request:async(path,options={})=>{calls.push({path,options});if(path==='/invoices/create_preview')return {customer:'cus_own',currency:'usd',amount_due:13000};if(path==='/invoices')return {data:[{customer:'cus_own',status:'paid',amount_paid:34900,hosted_invoice_url:'https://invoice.stripe.com/i/test'}]};if(path==='/customers/cus_own')return structuredClone(customer);if(path==='/subscriptions/sub_own'){if(options.method==='POST'){if('cancel_at_period_end' in options.params)subscription.cancel_at_period_end=options.params.cancel_at_period_end;if(options.params['items[0][price]']){const p=options.params['items[0][price]'];subscription.items.data[0].price={...subscription.items.data[0].price,id:p,unit_amount:p==='price_growth'?59900:34900}}}return structuredClone(subscription)}throw Error('Unexpected '+path)}};
  const kv={get:async k=>structuredClone(records.get(k)??null),eval:async(script,keys,args)=>{
    if(script.includes("'EX',ARGV[2]")){if(records.has(keys[0]))return 0;records.set(keys[0],args[0]);return 1}
    if(script.includes("~=ARGV[1]")){if(records.get(keys[0])!==args[0])return 0;records.delete(keys[0]);return 1}
    const audited=script.includes('local count=tonumber'),count=audited?Number(args[0]):keys.length,offset=audited?1:0;
    for(let i=0;i<count;i++)if((records.has(keys[i])?JSON.stringify(records.get(keys[i])):'')!==args[offset+i*2])return 0;
    for(let i=0;i<count;i++)records.set(keys[i],JSON.parse(args[offset+i*2+1]));
    if(audited)records.set(keys[count],[JSON.parse(args[count*2+1]),...(records.get(keys[count])||[])]);return 1;
  }};
  return {kv,provider,records,customer,subscription,calls};
}
test('Preview fails closed with live credentials or incomplete test catalog',()=>{
  assert.throws(()=>providerConfig({...env,STRIPE_SECRET_KEY:'sk_live_fixture'}),/isolated/);
  assert.throws(()=>providerConfig({...env,STRIPE_PRICE_PRO:''}),/configuration/);
  assert.equal(providerConfig({...env,VERCEL_ENV:'production',STRIPE_SECRET_KEY:'sk_live_fixture'}).mutationsAllowed,false);
});
test('provider never writes live billing and does not expose provider error details',async()=>{
  const provider=createProvider({...env,VERCEL_ENV:'production',STRIPE_SECRET_KEY:'sk_live_fixture'},async()=>{throw Error('must not run')});
  await assert.rejects(provider.request('/subscriptions/sub_own',{method:'POST'}),/not enabled/);
});
test('canonical subscription, invoices, usage and payment summary come from bound provider objects',async()=>{
  const f=fixture(),s=await canonicalBilling(f.kv,'w',f.provider);assert.equal(s.view.plan,'Starter');assert.equal(s.view.usage.remaining,40);assert.equal(s.view.usage.warning,true);assert.equal(s.view.usage.overageEnabled,false);assert.equal(s.view.invoices[0].amount,34900);assert.equal(s.view.renewalAt,1900000000);
});
for(const failure of ['customerMapping','subscriptionMapping','subscriptionCustomer','extraItem','unknownPrice','invoiceCustomer'])test('rejects '+failure+' before leaking billing',async()=>{
  const f=fixture();if(failure==='customerMapping')f.records.set('stripe:customer:cus_own','other');if(failure==='subscriptionMapping')f.records.set('stripe:subscription:sub_own','other');if(failure==='subscriptionCustomer')f.subscription.customer='cus_other';if(failure==='extraItem')f.subscription.items.data.push({id:'si_overage',price:{id:'price_overage'},quantity:1});if(failure==='unknownPrice')f.subscription.items.data[0].price.id='price_unknown';if(failure==='invoiceCustomer'){const request=f.provider.request;f.provider.request=(p,o)=>p==='/invoices'?{data:[{customer:'cus_other'}]}:request(p,o)}await assert.rejects(canonicalBilling(f.kv,'w',f.provider));
});
test('safe payment display contains no PAN or CVC and document hosts are allowlisted',()=>{
  assert.deepEqual(paymentSummary({type:'card',card:{brand:'visa',last4:'4242',number:'sensitive',cvc:'sensitive',exp_month:1,exp_year:2030}}),{type:'card',brand:'visa',last4:'4242',expMonth:1,expYear:2030});assert.equal(safeDocument('https://invoice.stripe.com.evil.test/a'),null);assert.equal(safeDocument('javascript:alert(1)'),null);
});
test('contact validation rejects malformed email, country, control characters',()=>{
  for(const contact of [{name:'Client',email:'bad'},{name:'Client\nInjected',email:'a@b.test'},{name:'Client',email:'a@b.test',address:{country:'USA'}}])assert.throws(()=>validateContact(contact));
});
test('plan preview is exact, confirmed once, audited and canonical refresh follows success',async()=>{
  const f=fixture(),revision=(await canonicalBilling(f.kv,'w',f.provider)).view.revision;
  const p=await prepareChange(f.kv,'w',f.provider,{action:'plan',plan:'Growth',revision});assert.equal(p.detail.amountDue,13000);assert.equal(f.subscription.items.data[0].price.id,'price_starter');
  const result=await applyChange(f.kv,'w','client@example.test',f.provider,{token:p.token,confirmed:true});assert.equal(result.billing.plan,'Growth');assert.equal(f.records.get('workspace:w').plan,'Growth');assert.equal(f.records.get('audit:w').length,1);
  const duplicate=await applyChange(f.kv,'w','client@example.test',f.provider,{token:p.token,confirmed:true});assert.equal(duplicate.duplicate,true);assert.equal(f.calls.filter(c=>c.options.method==='POST'&&c.path.startsWith('/subscriptions/')).length,1);
});
test('stale plan confirmation cannot mutate subscription',async()=>{
  const f=fixture(),revision=subscriptionRevision(f.subscription,f.customer),p=await prepareChange(f.kv,'w',f.provider,{action:'plan',plan:'Growth',revision});f.subscription.cancel_at_period_end=true;await assert.rejects(applyChange(f.kv,'w','client',f.provider,{token:p.token,confirmed:true}),/changed/);assert.equal(f.calls.filter(c=>c.path==='/subscriptions/sub_own'&&c.options.method==='POST').length,0);
});
test('cancel at period end retains workspace and can be reactivated',async()=>{
  const f=fixture();for(const action of ['cancel','reactivate']){const revision=(await canonicalBilling(f.kv,'w',f.provider)).view.revision,p=await prepareChange(f.kv,'w',f.provider,{action,revision});const r=await applyChange(f.kv,'w','client',f.provider,{token:p.token,confirmed:true});assert.equal(r.billing.cancelAtPeriodEnd,action==='cancel');assert.ok(f.records.get('workspace:w'))}
});
test('another tenant cannot use a prepared confirmation token',async()=>{
  const f=fixture(),revision=(await canonicalBilling(f.kv,'w',f.provider)).view.revision,p=await prepareChange(f.kv,'w',f.provider,{action:'cancel',revision});await assert.rejects(applyChange(f.kv,'other','intruder',f.provider,{token:p.token,confirmed:true}),/not found/);
});

test('native downgrade uses the canonical price and never adds setup or overages',async()=>{
 const f=fixture();f.subscription.items.data[0].price={...f.subscription.items.data[0].price,id:'price_growth',unit_amount:59900};const state=await canonicalBilling(f.kv,'w',f.provider),p=await prepareChange(f.kv,'w',f.provider,{action:'plan',plan:'Starter',revision:state.view.revision});const result=await applyChange(f.kv,'w','client',f.provider,{token:p.token,confirmed:true});assert.equal(result.billing.plan,'Starter');assert.equal(f.subscription.items.data.length,1);assert.equal(f.calls.find(c=>c.path==='/subscriptions/sub_own'&&c.options.method==='POST').options.params.proration_behavior,'always_invoice');
});
test('canonical contact change confirms refreshed name, email and address',async()=>{
 const f=fixture(),original=f.provider.request;f.provider.request=async(path,opts={})=>{if(path==='/customers/cus_own'&&opts.method==='POST'){Object.assign(f.customer,{name:opts.params.name,email:opts.params.email,phone:opts.params.phone,address:Object.fromEntries(Object.entries(opts.params).filter(([k])=>k.startsWith('address[')).map(([k,v])=>[k.slice(8,-1),v]))});return structuredClone(f.customer)}return original(path,opts)};const state=await canonicalBilling(f.kv,'w',f.provider),p=await prepareChange(f.kv,'w',f.provider,{action:'contact',revision:state.view.revision,contact:{name:'Updated Client',email:'billing@example.test',phone:'+15095550000',address:{country:'US',city:'Spokane'}}});const r=await applyChange(f.kv,'w','client',f.provider,{token:p.token,confirmed:true});assert.equal(r.billing.contact.email,'billing@example.test');assert.equal(r.billing.contact.address.city,'Spokane');
});
function paymentFixture(){const f=fixture(),original=f.provider.request;let intent;const method={id:'pm_owned',customer:'cus_own',type:'card',card:{brand:'visa',last4:'4242',exp_month:12,exp_year:2030}};f.provider.request=async(path,opts={})=>{if(path==='/setup_intents'){intent={id:'seti_owned',customer:'cus_own',status:'requires_confirmation',client_secret:'seti_owned_secret_fixture',metadata:{callercore_operation:opts.params['metadata[callercore_operation]']},payment_method:method.id};return structuredClone(intent)}if(path==='/setup_intents/seti_owned')return structuredClone(intent);if(path==='/payment_methods/pm_owned')return structuredClone(method);if(path==='/subscriptions/sub_own'&&opts.method==='POST'&&opts.params.default_payment_method)f.subscription.default_payment_method=method.id;return original(path,opts)};return {...f,method,get intent(){return intent}}}
test('SetupIntent authentication and explicit confirmation save only the owned payment method',async()=>{
 const f=paymentFixture(),state=await canonicalBilling(f.kv,'w',f.provider),setup=await setupPayment(f.kv,'w',f.provider,{revision:state.view.revision});await assert.rejects(confirmPayment(f.kv,'w','client',f.provider,{token:setup.token,confirmed:true}),/authentication/);f.intent.status='succeeded';const saved=await confirmPayment(f.kv,'w','client',f.provider,{token:setup.token,confirmed:true});assert.equal(saved.billing.paymentMethod.last4,'4242');assert.equal(f.subscription.default_payment_method,'pm_owned');assert.equal((await confirmPayment(f.kv,'w','client',f.provider,{token:setup.token,confirmed:true})).duplicate,true);
});
test('payment belonging to a different customer is never set as subscription default',async()=>{
 const f=paymentFixture(),state=await canonicalBilling(f.kv,'w',f.provider),setup=await setupPayment(f.kv,'w',f.provider,{revision:state.view.revision});f.intent.status='succeeded';f.method.customer='cus_other';await assert.rejects(confirmPayment(f.kv,'w','client',f.provider,{token:setup.token,confirmed:true}),/ownership/);assert.equal(f.subscription.default_payment_method,undefined);
});
test('invoice authentication client secret is exposed only after binding invoice to subscription and customer',async()=>{
 const f=fixture(),original=f.provider.request;f.subscription.status='past_due';f.subscription.latest_invoice='in_owned';const invoice={customer:'cus_own',parent:{subscription_details:{subscription:'sub_own'}},status:'open',amount_remaining:34900,currency:'usd',confirmation_secret:{client_secret:'pi_owned_secret_fixture'}};f.provider.request=(path,opts)=>path==='/invoices/in_owned'?invoice:original(path,opts);assert.equal((await canonicalBilling(f.kv,'w',f.provider)).view.paymentAction.amount,34900);invoice.customer='cus_other';await assert.rejects(canonicalBilling(f.kv,'w',f.provider),/ownership/);
});
test('old webhook failure cannot regress today’s recovered provider status',async()=>{
 const f=fixture();f.records.get('workspace:w').stripeBilling={lastEventCreatedAt:9000000};const r=await synchronizeBillingEvent(f.kv,'w',{id:'evt_old',created:1,type:'invoice.payment_failed',data:{object:{id:'in_old',customer:'cus_own',parent:{subscription_details:{subscription:'sub_own'}}}}},f.provider);assert.equal(r.status,'active');assert.equal(f.records.get('workspace:w').stripeBilling.lastEventCreatedAt,9000000);assert.equal([...f.records.values()].some(x=>x?.type==='failed'),false);
});
test('webhook receipt, canonical workspace and email record commit once across replay',async()=>{
 const f=fixture(),event={id:'evt_invoice',created:10,type:'invoice.paid',data:{object:{id:'in_owned',customer:'cus_own',subscription:'sub_own',amount_paid:34900}}};await synchronizeBillingEvent(f.kv,'w',event,f.provider);await synchronizeBillingEvent(f.kv,'w',event,f.provider);assert.equal(f.records.get('audit:w').length,1);assert.equal([...f.records.values()].filter(x=>x?.type==='invoice').length,1);
});
test('a replaced old subscription invoice cannot modify the current subscription',async()=>{
 const f=fixture(),original=f.provider.request;f.provider.request=(path,opts)=>path==='/subscriptions/sub_old'?{...f.subscription,id:'sub_old'}:original(path,opts);const r=await synchronizeBillingEvent(f.kv,'w',{id:'evt_oldsub',created:10,type:'invoice.payment_failed',data:{object:{customer:'cus_own',subscription:'sub_old'}}},f.provider);assert.equal(r.subscription_mismatch,true);assert.equal(f.records.get('workspace:w').stripeSubscriptionId,'sub_own');
});
test('replacement requires a newer subscription and terminal predecessor, never an older created event',async()=>{
 const f=fixture(),original=f.provider.request;f.subscription.created=100;const incoming={...structuredClone(f.subscription),id:'sub_new',created:50};f.provider.request=(path,opts)=>path==='/subscriptions/sub_new'?incoming:original(path,opts);const event={id:'evt_replace',created:10,type:'customer.subscription.created',data:{object:{id:'sub_new',customer:'cus_own'}}};assert.equal((await synchronizeBillingEvent(f.kv,'w',event,f.provider)).subscription_mismatch,true);incoming.created=200;f.subscription.status='canceled';await synchronizeBillingEvent(f.kv,'w',event,f.provider);assert.equal(f.records.get('workspace:w').stripeSubscriptionId,'sub_new');assert.equal(f.records.get('stripe:subscription:sub_new'),'w');
});
