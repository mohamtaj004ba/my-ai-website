const {createProvider,BillingError,id}=require('./billing-provider');
const {PLANS}=require('./plans');
async function verifiedPurchase(session,provider=createProvider(),env=process.env){
  if(!/^cs_[A-Za-z0-9_]+$/.test(session?.id||''))throw new BillingError('Invalid checkout identity.',400);
  const canonical=await provider.request('/checkout/sessions/'+session.id);
  if(canonical.id!==session.id||canonical.mode!=='subscription'||canonical.status!=='complete'||canonical.payment_status!=='paid'||!id(canonical.customer)||!id(canonical.subscription))throw new BillingError('Checkout payment is not confirmed.',503);
  const setupPrice=env.STRIPE_SETUP_PRICE_ID||env.STRIPE_PRICE_SETUP||(provider.config.mode==='live'?'price_1To9HhF0BXlPng7V0OBFPmQR':null);
  const [lines,subscription]=await Promise.all([provider.request('/checkout/sessions/'+session.id+'/line_items',{params:{limit:10}}),provider.request('/subscriptions/'+id(canonical.subscription))]);
  if(!Array.isArray(lines.data)||lines.has_more||lines.data.length!==2||lines.data.some(line=>line.quantity!==1))throw new BillingError('Checkout order needs reconciliation.',503);
  const recurring=lines.data.find(line=>Object.values(provider.config.prices).includes(id(line.price))),setup=lines.data.find(line=>id(line.price)===setupPrice),plan=Object.keys(provider.config.prices).find(p=>provider.config.prices[p]===id(recurring?.price));
  if(!plan||!setup||recurring.price.unit_amount!==PLANS[plan].price*100||setup.price.unit_amount!==50000||recurring.price.currency!=='usd'||setup.price.currency!=='usd'||setup.price.recurring||recurring.price.recurring?.interval!=='month'||recurring.price.recurring?.usage_type==='metered'||(recurring.price.recurring?.interval_count!=null&&recurring.price.recurring.interval_count!==1)||canonical.automatic_tax?.enabled)throw new BillingError('Checkout prices or tax terms require reconciliation.',503);
  if(id(subscription.customer)!==id(canonical.customer)||subscription.id!==id(canonical.subscription)||!['active','trialing'].includes(subscription.status)||subscription.items?.data?.length!==1||id(subscription.items.data[0].price)!==provider.config.prices[plan])throw new BillingError('Paid subscription could not be verified.',503);
  if(canonical.metadata?.plan&&canonical.metadata.plan!==plan)throw new BillingError('Checkout plan metadata disagrees with paid prices.',503);
  return {...canonical,_verifiedPlan:plan,_billing:{status:subscription.status,currentPeriodEnd:subscription.items.data[0].current_period_end||subscription.current_period_end||null,cancelAtPeriodEnd:!!subscription.cancel_at_period_end}};
}
module.exports={verifiedPurchase};
