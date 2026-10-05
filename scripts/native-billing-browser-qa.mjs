// Isolated UI fixtures: these checks never call Stripe or prove provider acceptance.
export async function installBillingFixture(page){
  const billing={plan:'Pro',monthlyAmount:99900,currency:'usd',status:'active',renewalAt:1900000000,cancelAtPeriodEnd:false,cancelAt:1900000000,pendingChange:false,revision:'browser-fixture-revision',usage:{minutes:486,allowance:null,remaining:null,warning:false,overageEnabled:false},paymentMethod:{type:'card',brand:'Visa',last4:'4242',expMonth:12,expYear:2030},contact:{name:'Preview QA',email:'preview-qa@callercore.test',phone:'+12025550100',address:{line1:'100 Test Avenue',city:'Seattle',state:'WA',postal_code:'98101',country:'US'}},invoices:[{number:'QA-1001',date:1897300000,amount:99900,currency:'usd',status:'paid',periodStart:1897300000,periodEnd:1900000000,document:'https://invoice.stripe.com/i/preview-fixture',pdf:null}],mutationsAllowed:true};
  await page.route('**/api/account?action=billing-state',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({billing})}));
  await page.route('**/api/account?action=billing-preview',route=>{const input=route.request().postDataJSON();return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({token:'a'.repeat(48),detail:{action:input.action,previousPlan:'Pro',...(input.plan?{plan:input.plan,amountDue:0,currency:'usd',monthlyAmount:input.plan==='Starter'?34900:59900}:{}),effectiveAt:1900000000,policy:'Changes are reviewed before confirmation.'}})})});
  // Unexpected confirmation is intercepted; visual checks cannot change a subscription.
  await page.route('**/api/account?action=billing-confirm',route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Isolated UI verification does not apply billing changes.'})}));
}
export async function verifyBillingDialogs(page,{assertLayout,shot,label,ensureView}){
  await ensureView(page,'billing');
  await page.locator('[data-billing-action="plans"]').waitFor({state:'visible'});
  if(!/999/.test(await page.locator('#nativeBillingContent').innerText()))throw Error('Canonical fixture monthly amount is missing');
  if(await page.locator('#nativeBillingContent').getByRole('link',{name:'View invoice'}).getAttribute('href')!=='https://invoice.stripe.com/i/preview-fixture')throw Error('Invoice document link changed');
  for(const action of ['plans','contact','cancel']){
    await page.locator('[data-billing-action="'+action+'"]').click();
    await page.locator('.billing-sheet:not([hidden])').waitFor();
    if(action==='cancel')await page.locator('#billingConfirm').waitFor();
    await assertLayout(page,label+'-billing-'+action);
    const geometry=await page.locator('.billing-sheet-box').boundingBox(),viewport=page.viewportSize();
    if(!geometry||geometry.x<0||geometry.y<0||geometry.x+geometry.width>viewport.width+1||geometry.y+geometry.height>viewport.height+1)throw Error('Billing dialog is outside the viewport');
    await shot(page,label+'-billing-'+action,{fullPage:false});
    if(action==='contact'&&viewport.width<=430){
      await page.setViewportSize({width:viewport.width,height:360});
      await page.locator('#billingContactForm input[name="name"]').focus();
      const footer=await page.locator('.billing-sheet-foot').boundingBox();
      if(!footer||footer.y<0||footer.y+footer.height>360)throw Error('Billing contact actions are hidden at keyboard height');
      if(await page.locator('#billingContactForm input[name="name"]').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))<16)throw Error('Billing phone inputs trigger browser zoom');
      await shot(page,label+'-billing-contact-keyboard',{fullPage:false});
      await page.setViewportSize(viewport);
    }
    await page.keyboard.press('Escape');
    await page.locator('.billing-sheet').waitFor({state:'hidden'});
    if(!await page.locator('[data-billing-action="'+action+'"]').evaluate(el=>el===document.activeElement))throw Error('Billing dialog did not return focus');
  }
}
