const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
function fixture(){
  let surface=null,opened='';const summary={focus(){document.activeElement=this}},button={dataset:{sectionNotification:'n1'},focus(){document.activeElement=this},addEventListener(type,fn){this.click=fn}};
  const view={id:'view-calls',querySelector:()=>surface,prepend(el){surface=el}};
  const document={activeElement:null,querySelector:()=>view,createElement:()=>({open:false,innerHTML:'',contains:el=>el===button||el===summary,querySelector:selector=>selector==='summary'?summary:button,querySelectorAll:()=>[button],setAttribute(k,v){this[k]=v},append(child){this.status=child},remove(){surface=null}})};
  const ctx=vm.createContext({document,notificationLoadError:'',notificationReadError:'',notificationData:[{id:'n1',title:'Lucy <Walker>',body:'Estimate follow-up',view:'calls',read:false},{id:'n2',view:'billing',read:false},{id:'n3',view:'calls',read:true}],esc:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),CSS:{escape:String},openNotification:id=>{opened=id}});
  vm.runInContext(source.slice(source.indexOf('function renderSectionNotifications('),source.indexOf('async function markViewNotificationsRead(')),ctx);
  return {ctx,document,button,summary,get surface(){return surface},get opened(){return opened},render:()=>vm.runInContext('renderSectionNotifications()',ctx)};
}
test('section alerts expose only matching unread records with safe text and their existing deep link',()=>{
  const f=fixture();f.render();assert.equal(f.surface.open,true);assert.match(f.surface.innerHTML,/1 unread alert in this section/);assert.match(f.surface.innerHTML,/Lucy &lt;Walker&gt;/);assert.doesNotMatch(f.surface.innerHTML,/n2|n3/);f.button.click();assert.equal(f.opened,'n1');assert.equal(f.ctx.notificationData[0].read,false);
});
test('alert refresh preserves collapse and focused record, then removes the panel only after verified read state',()=>{
  const f=fixture();f.render();f.surface.open=false;f.document.activeElement=f.button;f.render();assert.equal(f.surface.open,false);assert.equal(f.document.activeElement,f.button);f.ctx.notificationData[0].read=true;f.render();assert.equal(f.surface,null);
});
test('a failed alert destination remains visible with an announced recovery message',()=>{
  const f=fixture();f.ctx.notificationReadError='Record unavailable. Refresh and retry.';f.render();assert.equal(f.surface.status.role,'status');assert.equal(f.surface.status.textContent,f.ctx.notificationReadError);assert.match(f.surface.innerHTML,/n1/);assert.equal(f.ctx.notificationData[0].read,false);
});
test('Today queue distinguishes older and undated calls instead of displaying only a time',()=>{
  const ctx=vm.createContext({recordTime:x=>x.at||0,sameLocalDay:()=>false,Date});
  vm.runInContext(source.slice(source.indexOf('function formatAttentionDate('),source.indexOf('function aiAnsweringState(')),ctx);
  assert.equal(vm.runInContext('formatAttentionDate({})',ctx),'Date unavailable');
  assert.match(vm.runInContext('formatAttentionDate({at:Date.UTC(2025,8,23,10,59)})',ctx),/2025/);
  ctx.sameLocalDay=()=>true;assert.match(vm.runInContext('formatAttentionDate({at:Date.now()})',ctx),/^Today · /);
});
