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
  await context.close();
 }
}
