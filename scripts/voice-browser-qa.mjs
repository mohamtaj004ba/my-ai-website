// UI fixtures establish responsive controls and truthful states, never acoustic acceptance.
export async function verifyVoiceOperations({makeContext,baseURL,shot,report}){
 report.voiceOperations={fixture:true,realCalls:false,layouts:[],states:[]};
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['tablet',{width:768,height:1024}],['phone',{width:390,height:844}],['small-phone',{width:320,height:760}]]){
  const {context,page}=await makeContext(viewport,'voice-'+name);
  await page.route('**/api/account?action=session',r=>r.fulfill({json:{user:{role:'admin',workspaceId:'fixture'}}}));
  let body={voice:{state:'launch_gated',label:'Voice testing is not enabled',controlsAvailable:false,revision:0},policy:null};
  await page.route('**/api/voice?*',r=>r.fulfill({json:body}));
  await page.goto(baseURL+'/voice-operations.html');await page.locator('#operations').waitFor({state:'visible'});await page.locator('#voice-state').getByText('Voice testing is not enabled').waitFor();
  const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),smallTargets:[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height<44).length}));
  if(layout.scrollWidth>layout.width+4||layout.smallTargets)throw Error('Voice layout '+name+' '+JSON.stringify(layout));report.voiceOperations.layouts.push({name,...layout});
  if(!await page.locator('#pause-voice').isDisabled()||!await page.locator('#resume-voice').isDisabled())throw Error('Unverified voice enabled controls');
  await shot(page,'voice-'+name+'-gated');
  await page.locator('[name=services]').fill('Repair\nMaintenance');body={voice:{state:'error',label:'Voice connection needs attention',controlsAvailable:false,revision:1},policy:null};
  await page.locator('#load-settings').click();await page.locator('#voice-state').getByText('Voice connection needs attention').waitFor();
  if(await page.locator('[name=services]').inputValue()!=='Repair\nMaintenance')throw Error('Voice draft lost without replacement settings');report.voiceOperations.states.push(name+'-error');
  body={voice:{state:'paused',label:'Internal test answering paused',controlsAvailable:true,revision:2},policy:null};await page.locator('#load-settings').click();await page.locator('#resume-voice').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('resume-voice').disabled);if(!await page.locator('#pause-voice').isDisabled())throw Error('Paused state offered duplicate pause');
  await shot(page,'voice-'+name+'-paused');await context.close();
 }
 const {context,page}=await makeContext({width:390,height:844},'voice-no-access');await page.route('**/api/account?action=session',r=>r.fulfill({status:401,json:{error:'Authentication required'}}));await page.goto(baseURL+'/voice-operations.html');await page.locator('#page-status').getByText('Sign in with an administrator account').waitFor();if(await page.locator('#operations').isVisible())throw Error('Voice controls shown without access');await context.close();
}
