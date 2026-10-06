// UI states are intercepted fixtures, never payment acceptance or customer email delivery.
export async function verifyCustomerExperience({makeContext,baseURL,shot,report}){
 report.customerExperience={fixture:true,states:[],layouts:[]};
 async function assertLayout(page,label){const state=await page.evaluate(()=>({width:innerWidth,scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),smallInputs:[...document.querySelectorAll('input')].filter(el=>el.getClientRects().length&&parseFloat(getComputedStyle(el).fontSize)<16).length,smallButtons:[...document.querySelectorAll('main button')].filter(el=>el.getClientRects().length&&el.getBoundingClientRect().height<44).length}));if(state.scrollWidth>state.width+4||state.smallButtons||state.smallInputs)throw Error(label+' customer layout failure '+JSON.stringify(state));report.customerExperience.layouts.push({label,...state});}

 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['phone',{width:390,height:844}],['small-phone',{width:320,height:760}]]){
  const {context,page}=await makeContext(viewport,'customer-'+label);
  let response={paid:true,onboarding:false,plan:'Starter',amountTotal:84900,currency:'usd'};
  await page.route('**/api/create-checkout-session?receipt=*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)}));
  for(const [state,data] of [['paid',response],['ready',{...response,onboarding:true}],['processing',{paid:false,onboarding:false,status:'complete'}],['open',{paid:false,onboarding:false,status:'open'}],['expired',{paid:false,onboarding:false,status:'expired'}],['unavailable',{}]]){
   response=data;await page.goto(baseURL+'/checkout-complete?receipt='+'a'.repeat(48));
   await page.locator('.confirmation-card[data-state="'+state+'"]').waitFor();
   if(['paid','processing','unavailable'].includes(state)&&await page.locator('#checkoutLink').isVisible())throw Error('Unresolved payment offered another checkout');
   if(state==='paid'&&!/849/.test(await page.locator('#receiptAmount').innerText()))throw Error('Verified receipt amount missing');
   await assertLayout(page,'customer-'+label+'-'+state);await shot(page,'customer-'+label+'-'+state);report.customerExperience.states.push(label+'-'+state);
  }
  let loginOk=true;await page.route('**/api/account?action=request',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(loginOk?{ok:true}:null)}));
  await page.goto(baseURL+'/login');await page.locator('#email').fill('ui-fixture@example.test');await page.locator('#submit').click();await page.locator('#status[data-state=success]').waitFor();await assertLayout(page,'customer-'+label+'-sign-in-sent');await shot(page,'customer-'+label+'-sign-in-sent');
  loginOk=false;await page.locator('#submit').click();await page.locator('#status[data-state=error]').waitFor();await assertLayout(page,'customer-'+label+'-sign-in-unavailable');await shot(page,'customer-'+label+'-sign-in-unavailable');
  await page.route('https://js.stripe.com/endive/stripe.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.Stripe=function(){return {initCheckoutElementsSdk:function(){return {loadActions:async function(){return {type:'success',actions:{confirm:async function(){return {error:window.__paymentFixtureError};}}};},createPaymentElement:function(){return {mount:function(selector){document.querySelector(selector).textContent='Isolated payment form · no charge or card collection';}};},destroy:function(){}};}};};`}));
  await page.route('**/api/create-checkout-session',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({receipt:'a'.repeat(48),publishableKey:'pk_test_uifixture',clientSecret:'cs_test_uifixture_secret_value',summary:{plan:'Starter',monthlyAmount:34900,setupAmount:50000,dueToday:84900}})}));
  for(const [kind,error] of [['decline',{type:'card_error',message:'Your card has insufficient funds.'}],['connection',{type:'api_connection_error',message:'Connection interrupted.'}]]){
   await page.goto(baseURL+'/get-started');await page.locator('#toBusiness').click();
   for(const [name,value] of [['name','UI Fixture'],['business','Isolated example'],['email','ui-fixture@example.test'],['phone','2025550100']])await page.locator('#startForm [name="'+name+'"]').fill(value);
   await page.locator('#startForm [name=industry]').selectOption({label:'Professional Services'});await page.locator('#startForm [name=billingTermsAccepted]').check();await page.locator('#toPayment').click();await page.locator('#confirmSignupPayment').waitFor({state:'visible'});await page.locator('#paymentTerms').check();
   await page.evaluate(value=>{window.__paymentFixtureError=value;},error);await page.locator('#confirmSignupPayment').click();await page.locator('#paymentError').waitFor({state:'visible'});
   if(kind==='connection'&&!await page.locator('.payment-status-link').isVisible())throw Error('Ambiguous payment lost its status recovery link');
   if(kind==='decline'&&await page.locator('#confirmSignupPayment').isDisabled())throw Error('Card correction remained disabled after a clear decline');
   await assertLayout(page,'customer-'+label+'-payment-'+kind);await shot(page,'customer-'+label+'-payment-'+kind);report.customerExperience.states.push(label+'-payment-'+kind);
  }
  await context.close();
 }
}
