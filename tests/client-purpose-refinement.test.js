const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8'),html=fs.readFileSync('dashboard.html','utf8');
function extract(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)))}
test('Client Care fails closed when the selected workspace changes during loading',async()=>{
 const status={},button={dataset:{careWorkspace:'a',careAction:'settings'},parentElement:{querySelector:()=>status}},ctx=vm.createContext({adminCareNavigationPending:false,adminClientSaving:false,adminTechSaving:false,currentAdminClient:{id:'b'},openAdminClient:async()=>true,String,Error,document:{getElementById(){throw Error('Must not open unrelated configuration')}}});
 vm.runInContext(extract('async function openAdminCareWorkspace(','\nfunction bindAdminCareWorkspaceActions('),ctx);
 assert.equal(await ctx.openAdminCareWorkspace(button),false);assert.match(status.textContent,/could not be verified/);assert.equal(button.disabled,false);assert.equal(ctx.adminCareNavigationPending,false);
});
test('Client Care phone refresh failure cannot open stale routing controls',async()=>{
 let opened=false;const status={},button={dataset:{careWorkspace:'a',careAction:'phone'},parentElement:{querySelector:()=>status}},ctx=vm.createContext({adminCareNavigationPending:false,adminClientSaving:false,adminTechSaving:false,currentAdminClient:{id:'a'},openAdminClient:async()=>true,refreshAdminView:async()=>{throw Error('Phone data unavailable')},openPhoneModal:()=>opened=true,String,Error});
 vm.runInContext(extract('async function openAdminCareWorkspace(','\nfunction bindAdminCareWorkspaceActions('),ctx);
 assert.equal(await ctx.openAdminCareWorkspace(button),false);assert.equal(opened,false);assert.equal(status.textContent,'Phone data unavailable');assert.equal(button.disabled,false);
});
test('Client Care portal failure remains retryable instead of reporting success',async()=>{
 const status={},button={dataset:{careWorkspace:'a',careAction:'portal'},parentElement:{querySelector:()=>status}},ctx=vm.createContext({adminCareNavigationPending:false,adminClientSaving:false,adminTechSaving:false,currentAdminClient:{id:'a'},openAdminClient:async()=>true,viewAdminClient:async()=>false,String,Error});
 vm.runInContext(extract('async function openAdminCareWorkspace(','\nfunction bindAdminCareWorkspaceActions('),ctx);
 assert.equal(await ctx.openAdminCareWorkspace(button),false);assert.match(status.textContent,/Could not open/);assert.equal(button.disabled,false);
});
test('call alerts remain tied to unread notifications for the exact call record',()=>{
 const ctx=vm.createContext({notificationData:[{read:false,view:'calls',meta:{callId:'a'}},{read:true,view:'calls',meta:{callId:'a'}},{read:false,view:'support',meta:{callId:'a'}},{read:false,view:'calls',meta:{callId:'b'}}],String});
 vm.runInContext(extract('function callRecordAlerts(','\nfunction callRecordAlertBadge('),ctx);assert.equal(ctx.callRecordAlerts('a').length,1);assert.equal(ctx.callRecordAlerts('missing').length,0);
});
test('Settings locks other sections while retaining the active draft',()=>{
 const fields={profile:{disabled:true,closest:()=>({dataset:{settingsSection:'profile'}})},location:{disabled:true,closest:()=>({dataset:{settingsSection:'location'}})}};
 const ctx=vm.createContext({settingsSaving:false,settingsEditing:false,settingsEditingSection:'profile',clientEditGeneration:0,document:{body:{classList:{contains:()=>false}},getElementById:id=>fields[id]||null,querySelectorAll:()=>[]},settingsControlIds:()=>Object.keys(fields),renderSettingsReadValues(){},renderBusinessLogo(){},resetBusinessLogoProcessing(){},settingsFieldError(){}});
 vm.runInContext(extract('function setSettingsEditing(','\nfunction renderAiAnsweringControl('),ctx);ctx.setSettingsEditing(true,{section:'profile'});assert.equal(fields.profile.disabled,false);assert.equal(fields.location.disabled,true);assert.equal(ctx.setSettingsEditing(true,{section:'location'}),false);assert.equal(ctx.settingsEditingSection,'profile');
 ctx.settingsEditing=false;ctx.document.body.classList.contains=()=>true;assert.equal(ctx.setSettingsEditing(true,{section:'profile'}),false);
});
test('Recorded sessions stays accessible from Contacts without duplicating the primary navigation',()=>{
 assert.doesNotMatch(html,/<button[^>]*class="nav-item[^>]*data-view="conversations"/);assert.match(html,/data-view="conversations"[^>]*data-feature="unifiedInbox"[^>]*id="contactRecordedSessions"/);
});
test('Settings markup closes the main landmark without leaking broken tag text',()=>{assert.match(html,/<\/section><\/main>/);assert.doesNotMatch(html,/<\/section>\/main>/)});
