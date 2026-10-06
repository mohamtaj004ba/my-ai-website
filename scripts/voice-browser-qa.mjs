// UI fixtures establish responsive controls and truthful states, never acoustic acceptance.
export async function verifyVoiceOperations({makeContext,baseURL,shot,report}){
 report.voiceOperations={fixture:true,realCalls:false,layouts:[],states:[]};
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['tablet',{width:768,height:1024}],['phone',{width:390,height:844}],['small-phone',{width:320,height:760}]]){
  const {context,page}=await makeContext(viewport,'voice-'+name);
  await page.route('**/api/account?action=session',r=>r.fulfill({json:{user:{role:'admin',workspaceId:'fixture'}}}));
  let body={voice:{state:'launch_gated',label:'Voice testing is not enabled',controlsAvailable:false,revision:0},policy:null};
  await page.route('**/api/voice?*',r=>r.fulfill({json:body}));
  await page.goto(baseURL+'/voice-operations.html');await page.locator('#operations').waitFor({state:'visible'});await page.locator('#save-status').getByText('Choose an isolated test workspace',{exact:false}).waitFor();await page.locator('[name=workspaceId]').fill('fixture');await page.locator('#load-settings').click();await page.locator('#voice-state').getByText('Voice testing is not enabled').waitFor();
  const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),smallTargets:[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height<44).length}));
  if(layout.scrollWidth>layout.width+4||layout.smallTargets)throw Error('Voice layout '+name+' '+JSON.stringify(layout));report.voiceOperations.layouts.push({name,...layout});
  if(!await page.locator('#pause-voice').isDisabled()||!await page.locator('#resume-voice').isDisabled())throw Error('Unverified voice enabled controls');
  await shot(page,'voice-'+name+'-gated');
  await page.locator('[name=services]').fill('Repair\nMaintenance');body={voice:{state:'error',label:'Voice connection needs attention',controlsAvailable:false,revision:1},policy:null};
  await page.locator('#load-settings').click();await page.locator('#voice-state').getByText('Voice connection needs attention').waitFor();
  if(await page.locator('[name=services]').inputValue()!=='Repair\nMaintenance')throw Error('Voice draft lost without replacement settings');report.voiceOperations.states.push(name+'-error');
  body={voice:{state:'paused',label:'Internal test answering paused',controlsAvailable:true,revision:2},policy:null};await page.locator('#load-settings').click();await page.locator('#resume-voice').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('resume-voice').disabled);if(!await page.locator('#pause-voice').isDisabled())throw Error('Paused state offered duplicate pause');
  await shot(page,'voice-'+name+'-paused');
  let savedPolicy;
  const configured={timezone:'America/Los_Angeles',voice:'marin',schedule:[{day:1,open:540,close:1020}],holidays:['2026-12-25'],maxDurationSeconds:180,services:['Repair'],faqs:[],prohibitedClaims:[],afterHours:'capture',serviceArea:'Spokane',pricingGuidance:'',emergencyGuidance:'',transferNumber:'',tone:'Warm',disclosure:'AI phone assistant; calls may be transcribed.',specialInstructions:''};
  body={voice:{state:'ready',label:'Internal test answering enabled',controlsAvailable:true,revision:3,purpose:'internal'},policy:configured};
  await page.unroute('**/api/voice?*');await page.route('**/api/voice?*',async r=>{if(r.request().method()==='POST'){savedPolicy=r.request().postDataJSON().policy;await r.fulfill({json:{voice:body.voice}})}else await r.fulfill({json:body})});
  await page.locator('#load-settings').click();await page.locator('[name=holidays]').getAttribute('name');await page.waitForFunction(()=>document.querySelector('[name=holidays]').value==='2026-12-25');
  if(await page.locator('[name=maxDurationSeconds]').inputValue()!=='180')throw Error('Saved duration was not loaded');
  await page.locator('#voice-config button[type=submit], #voice-config .actions button:not([type])').click();await page.locator('#save-status').getByText('Test configuration saved',{exact:false}).waitFor();
  if(savedPolicy?.holidays?.[0]!=='2026-12-25'||savedPolicy.maxDurationSeconds!==180)throw Error('Voice save erased holiday/duration policy');
  page.__callerCoreExpectedVoiceTimeout=true;await page.unroute('**/api/voice?*');await page.route('**/api/voice?*',r=>r.fulfill({status:503,json:{code:'VOICE_PROVIDER_TIMEOUT',error:'Voice provider timed out'}}));
  await page.locator('#verify-state').click();await page.locator('#save-status').getByText('Voice provider timed out').waitFor();if(!await page.locator('#pause-voice').isDisabled()||!await page.locator('#resume-voice').isDisabled())throw Error('Failed verification kept answering controls enabled');
  await page.locator('[name=workspaceId]').fill('other-fixture');if(!await page.locator('#pause-voice').isDisabled()||!await page.locator('#resume-voice').isDisabled())throw Error('Workspace switch retained prior controls');
  report.voiceOperations.states.push(name+'-policy-preserved',name+'-failed-verification',name+'-workspace-switch-guarded');await context.close();
 }
 const {context,page}=await makeContext({width:390,height:844},'voice-no-access');await page.route('**/api/account?action=session',r=>r.fulfill({status:401,json:{error:'Authentication required'}}));await page.goto(baseURL+'/voice-operations.html');await page.locator('#page-status').getByText('Sign in with an administrator account').waitFor();if(await page.locator('#operations').isVisible())throw Error('Voice controls shown without access');await context.close();
}
