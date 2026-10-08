import assert from 'node:assert/strict';
import path from 'node:path';
import {previewRequestHeaders} from './preview-request-headers.mjs';
export function feedbackRequestHeaders(url,headers,baseURL){
 const scoped=previewRequestHeaders(url,headers,baseURL);
 if(new URL(url).origin!==new URL(baseURL).origin){
  for(const name of Object.keys(scoped))if(name.toLowerCase()==='x-qa-secret')delete scoped[name];
 }
 return scoped;
}
export async function verifyPublicFeedback({browser,baseURL,headers={},outDir}){
 const report={checks:[],screenshots:[],scope:'Public UI with isolated API fixtures; no email sent, payment submitted, or telephone call placed'};
 for(const width of [1440,768,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  // Preview credentials belong only to this deployment, including during redirects.
  await context.route('**/*',route=>route.continue({headers:feedbackRequestHeaders(route.request().url(),{...route.request().headers(),...headers},baseURL)}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let contactMode='malformed',contactCount=0,payload;
  await page.route('**/api/contact',async route=>{contactCount++;payload=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(contactMode==='malformed'?{ok:true}:contactMode==='warning'?{ok:true,prospectId:'fixture-help',warning:'notification unavailable'}:{ok:true,prospectId:'fixture-help'})});});
  await page.route('**/api/account?action=request',route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.route('**/api/reveal-token',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({token:(Date.now()-2000)+'.'+'a'.repeat(64)})}));
  await page.route('**/api/demo-number',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({number:'+15095550100',display:'(509) 555-0100'})}));
  async function layout(label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,label+' overflow at '+width);}
  await page.goto(baseURL+'/');await layout('homepage');
  assert.equal(await page.locator('.hero-copy .button').getAttribute('href'),'/live-demo');
  for(const [calls,length,plan] of [[100,3,'Starter'],[110,3,'Growth'],[200,3,'Growth'],[210,3,'Pro'],[1000,8,'Pro']]){
   await page.locator('#monthlyCalls').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},String(calls));
   await page.locator('#callLength').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},String(length));
   assert.equal(await page.locator('#planSuggestion').textContent(),plan);assert.equal(await page.locator('#planChoice').getAttribute('href'),'/get-started?plan='+plan);
  }
  if(outDir){const file='feedback-planner-'+width+'.png';await page.locator('.volume-planner').screenshot({path:path.join(outDir,file)});report.screenshots.push(file);}
  await page.locator('#planChoice').click();await page.waitForURL('**/get-started?plan=Pro');assert.equal(await page.locator('[data-plan="Pro"]').getAttribute('aria-pressed'),'true');
  for(const plan of ['Starter','Growth','Pro']){
   await page.goto(baseURL+'/');const card=page.locator('.price-grid article').filter({has:page.locator('a[href="/get-started?plan='+plan+'"]')});
   await card.locator('h3').click();await page.waitForURL('**/get-started?plan='+plan);assert.equal(await page.locator('[data-plan="'+plan+'"]').getAttribute('aria-pressed'),'true');
  }
  await page.goto(baseURL+'/');await page.locator('.price-grid article a').first().focus();await page.keyboard.press('Enter');await page.waitForURL('**/get-started?plan=Starter');
  for(const slug of ['home-services','medical','legal','property','automotive','professional-services']){
   await page.goto(baseURL+'/industries/'+slug);assert.equal(await page.locator('.industry-moment').count(),3);await layout(slug);
   await page.locator('.industry-moment summary').first().click();assert.equal(await page.locator('.industry-moment details').first().getAttribute('open'),'');
   if(outDir&&slug==='medical'){await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});const file='feedback-medical-'+width+'.png';await page.screenshot({path:path.join(outDir,file),fullPage:true});report.screenshots.push(file);}
  }
  await page.goto(baseURL+'/live-demo');assert.equal(await page.locator('#demoNote').count(),0);assert.equal(await page.locator('.demo-prompt-card a').count(),0);
  await page.locator('#demoBtn').click();await page.locator('#demoNumber').waitFor({state:'visible'});assert.equal(await page.locator('#demoLabel').textContent(),'Copy number');assert.equal(await page.locator('#demoCall').getAttribute('href'),'tel:+15095550100');await layout('demo');
  await page.goto(baseURL+'/login?error=expired');assert.match(await page.locator('#status').textContent(),/expired/);await layout('login');
  await page.locator('#email').fill('preview-qa@callercore.test');await page.locator('#submit').click();await page.waitForFunction(()=>document.querySelector('#status').dataset.state==='success');
  await page.locator('#helpToggle').click();assert.equal(await page.locator('#supportEmail').inputValue(),'preview-qa@callercore.test');
  await page.locator('#supportName').fill('Preview QA');await page.locator('#supportMessage').fill('Fixture only: sign-in link not received.');
  await page.locator('#supportSubmit').click();await page.waitForFunction(()=>document.querySelector('#supportStatus').dataset.state==='error');assert.equal(await page.locator('#supportSubmit').isEnabled(),true);assert.equal(await page.locator('#supportMessage').inputValue(),'Fixture only: sign-in link not received.');
  contactMode='success';await page.locator('#supportSubmit').click();await page.waitForFunction(()=>document.querySelector('#supportStatus').dataset.state==='success');
  assert.equal(contactCount,2);assert.equal(payload.category,'Login help');assert.equal(Object.hasOwn(payload,'marketingEmailConsent'),false);assert.equal(await page.locator('#supportSubmit').isDisabled(),true);
  await page.locator('#supportForm').evaluate(el=>el.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(contactCount,2);await layout('inline support');
  if(outDir){const file='feedback-login-'+width+'.png';await page.screenshot({path:path.join(outDir,file),fullPage:true});report.screenshots.push(file);}
  await page.goto(baseURL+'/login?next=/admin-dashboard');assert.equal(await page.locator('.eyebrow').textContent(),'Admin portal');
  assert.deepEqual(errors,[]);report.checks.push({width,passed:true,industries:6,plannerBoundaries:5,planSignups:3,loginHelp:'malformed receipt/retry/success/duplicate guard',demo:'fixture reveal with explicit copy/call actions'});
  await context.close();
 }return report;
}
