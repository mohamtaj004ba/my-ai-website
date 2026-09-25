const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','dashboard.js'),'utf8');
function fixture(ok){
  const status={textContent:'',className:''},button={disabled:false,textContent:'Save'};
  const context=vm.createContext({agentSaving:false,lockFormControls:()=>()=>{},agentEditing:'identity',agentEditSnapshot:{name:'Saved'},agentData:{name:'Saved'},phoneRoutingData:null,demoMode:false,activeAgentSection:()=> 'identity',collectAgent:()=>({name:'Draft'}),CSS:{escape:x=>x},document:{getElementById:id=>id==='agentFormStatus'?status:null,querySelector:()=>button},fetch:async()=>({ok,json:async()=>ok?{agent:{name:'Canonical'}}:{error:'Service unavailable'}}),renderAgent:()=>{},setTimeout:()=>{}});
  vm.runInContext(source.slice(source.indexOf('async function saveAgent('),source.indexOf('function feedbackStatusLabel(')),context);
  return {context,status,button,save:()=>vm.runInContext('saveAgent()',context)};
}
test('failed receptionist save leaves draft editing open and provides inline retry guidance',async()=>{
  const {context,status,button,save}=fixture(false);await save();
  assert.equal(context.agentEditing,'identity');assert.equal(context.agentData.name,'Saved');
  assert.match(status.textContent,/Service unavailable.*draft is still open/);assert.match(status.className,/error/);assert.equal(button.disabled,false);
});
test('successful receptionist save uses server data and closes draft with persistent confirmation',async()=>{
  const {context,status,button,save}=fixture(true);await save();
  assert.equal(context.agentEditing,false);assert.equal(context.agentEditSnapshot,null);assert.equal(context.agentData.name,'Canonical');
  assert.equal(status.textContent,'Receptionist settings saved.');assert.match(status.className,/success/);assert.equal(button.disabled,false);
});
