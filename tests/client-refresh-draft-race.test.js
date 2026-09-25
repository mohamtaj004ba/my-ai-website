const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const source=require('node:fs').readFileSync('dashboard.js','utf8');
function fixture(){
  let finish,applied=0,requested=0,message='';
  const pending=new Promise(resolve=>finish=resolve);
  const ctx=vm.createContext({demoMode:false,clientRefreshInFlight:false,clientEditGeneration:0,agentEditing:false,settingsEditing:false,document:{body:{dataset:{dashboard:'client'}}},fetchJsonRetry:async()=>{requested++;return pending},applyClientDashboardData:()=>applied++,renderClientData:()=>{},setDataHealth:()=>{},updateClientRefreshStamp:()=>{},setClientSyncState:(_,text)=>message=text,console:{error:()=>{}}});
  vm.runInContext(source.slice(source.indexOf('async function refreshClientDashboard('),source.indexOf('function initClientLiveRefresh(')),ctx);
  return {ctx,finish,applied:()=>applied,requested:()=>requested,message:()=>message,refresh:()=>vm.runInContext('refreshClientDashboard({button:{}})',ctx)};
}
test('refresh response cannot overwrite a draft opened while the request was pending',async()=>{
  const f=fixture(),p=f.refresh();f.ctx.settingsEditing=true;f.finish({});await p;assert.equal(f.applied(),0);assert.match(f.message(),/preserve/);assert.equal(f.ctx.clientRefreshInFlight,false);
});
test('refresh response cannot overwrite a save completed after the request began',async()=>{
  const f=fixture(),p=f.refresh();f.ctx.clientEditGeneration++;f.finish({});await p;assert.equal(f.applied(),0);
});
test('normal refresh applies data, while explicit refresh never discards an open draft',async()=>{
  const f=fixture();f.ctx.agentEditing='identity';await f.refresh();assert.equal(f.requested(),0);assert.match(f.message(),/Save or cancel/);
  f.ctx.agentEditing=false;const p=f.refresh();f.finish({});await p;assert.equal(f.applied(),1);
});
