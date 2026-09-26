const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','dashboard.js'),'utf8');
const part=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function fixture(kind,ok){
  const controls=[{disabled:false,value:'Draft'},{disabled:true,value:''}];
  const status={textContent:'',className:''},button={disabled:false,textContent:'Save'};controls.push(button);
  let resolve,calls=0;const pending=new Promise(r=>resolve=r);
  const context=vm.createContext({agentSaving:false,settingsSaving:false,businessLogoProcessing:false,agentEditing:'identity',settingsEditing:true,agentEditSnapshot:{name:'Original'},agentData:{name:'Original'},settingsData:{businessName:'Original'},phoneRoutingData:null,pendingBusinessLogo:null,demoMode:false,activeAgentSection:()=> 'identity',collectAgent:()=>({name:'Draft'}),CSS:{escape:x=>x},validateSettingsForm:()=>true,normalizePhone:x=>x,normalizeWebsite:x=>x,document:{getElementById:id=>id.startsWith('view-')?{querySelectorAll:()=>controls}:id.endsWith('FormStatus')?status:id==='saveSettingsButton'?button:null,querySelector:()=>button},fetch:async()=>{calls++;await pending;return {ok,json:async()=>ok?{agent:{name:'Canonical'},settings:{logoDataUrl:''}}:{error:'Unavailable'}}},renderAgent:()=>{},setSettingsEditing:x=>{context.settingsEditing=x},setTimeout:()=>{}});
  vm.runInContext(part('function lockFormControls(', 'async function saveAgent('),context);
  vm.runInContext(kind==='agent'?part('async function saveAgent(','function feedbackStatusLabel('):part('async function saveSettings(','function renderPhoneRouting('),context);
  return {context,controls,status,calls:()=>calls,resolve,save:()=>vm.runInContext(kind==='agent'?'saveAgent()':'saveSettings()',context)};
}
for(const kind of ['agent','settings'])for(const ok of [true,false])test(`${kind} save locks controls, rejects duplicate submits and unlocks after ${ok?'success':'failure'}`,async()=>{
  const f=fixture(kind,ok),saving=f.save();
  assert.equal(f.context[kind==='agent'?'agentSaving':'settingsSaving'],true);
  assert.ok(f.controls.every(x=>x.disabled));await f.save();assert.equal(f.calls(),1);
  f.resolve();await saving;
  assert.equal(f.controls[0].disabled,false);assert.equal(f.controls[1].disabled,true);
  assert.equal(f.context[kind==='agent'?'agentSaving':'settingsSaving'],false);
  assert.equal(!!f.context[kind==='agent'?'agentEditing':'settingsEditing'],!ok);
  if(!ok)assert.match(f.status.textContent,/Unavailable/);
});
test('navigation cannot reset an open draft or interrupt a pending save',()=>{
  const context=vm.createContext({agentSaving:true,settingsSaving:false,phoneSaving:false,agentEditing:'identity',settingsEditing:false,document:{querySelector:()=>({id:'view-agent'})}});
  vm.runInContext(part('function showView(',"document.querySelectorAll('[data-view]')"),context);
  vm.runInContext("showView('settings')",context);
  context.agentSaving=false;vm.runInContext("showView('agent')",context);
  assert.equal(context.agentEditing,'identity');
});
