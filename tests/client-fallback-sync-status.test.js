'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
function fixture(failed=[]){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',dataset:{},classList:{toggle(){}}});return nodes.get(id);},health=[],requests=[];
 const ctx=vm.createContext({demoMode:false,clientLastSyncAt:1234,document:{getElementById:node},Date,Promise,Array,Number,Set,String,Error,console:{warn(){},error(){}},fetchJsonRetry:async url=>{requests.push(url);const action=url.split('action=')[1];if(action==='client-dashboard-data'||failed.includes(action))throw Error('Fictional unavailable feed');if(action==='calls-viewed')return {ids:[],coverage:{verified:true,limited:false,limit:2000}};return {};},setClientLoading(){},setDataHealth:(id,bad)=>health.push({id,bad}),applyClientFallbackPayload:()=>true,loadFollowupState:async()=>{},callViewedCoverage:{},callViewedIds:new Set(),buildLocalAnalytics:()=>({}),renderClientData(){},loadSecondaryClientData(){},refreshClientSupportHistory(){}});
 vm.runInContext(source.slice(source.indexOf('function setClientSyncState('),source.indexOf('async function refreshClientDashboard('))+source.slice(source.indexOf('async function loadOperations('),source.indexOf('\nfunction recordTime(')),ctx);
 return{ctx,node,health,requests,load:()=>vm.runInContext('loadOperations()',ctx)};
}
test('failed critical fallback retains last successful sync timestamp and exposes error instead of Live',async()=>{
 const f=fixture(['calls']);await f.load();assert.equal(f.health.at(-1).bad,true);assert.equal(f.node('clientLiveLabel').textContent,'Sync issue');assert.equal(f.node('clientLiveStatus').dataset.syncState,'error');assert.equal(f.ctx.clientLastSyncAt,1234);assert.match(f.node('clientLastRefresh').textContent,/Could not refresh calls/);assert.equal(f.requests.filter(x=>x.endsWith('action=calls')).length,2);
});
test('successful critical-data fallback recovery marks Live with a new successful timestamp',async()=>{
 const failed=['calls'],f=fixture(failed);await f.load();assert.equal(f.node('clientLiveLabel').textContent,'Sync issue');failed.length=0;await f.load();assert.equal(f.health.at(-1).bad,false);assert.equal(f.node('clientLiveLabel').textContent,'Live');assert.ok(f.ctx.clientLastSyncAt>1234);assert.match(f.node('clientLastRefresh').textContent,/^Updated /);
});
test('an optional feed failure alone does not mislabel complete critical-data recovery as unavailable',async()=>{
 const f=fixture(['integrations']);await f.load();assert.equal(f.health.at(-1).bad,false);assert.equal(f.node('clientLiveStatus').dataset.syncState,'live');assert.ok(f.ctx.clientLastSyncAt>1234);
});
test('an unexpected fallback failure clears a previous Live claim without advancing the successful timestamp',async()=>{
 const f=fixture();await f.load();const lastSuccessful=f.ctx.clientLastSyncAt;assert.equal(f.node('clientLiveLabel').textContent,'Live');
 f.ctx.loadFollowupState=async()=>{throw Error('Fictional follow-up load failure');};await f.load();assert.equal(f.health.at(-1).bad,true);assert.equal(f.node('clientLiveLabel').textContent,'Sync issue');assert.equal(f.ctx.clientLastSyncAt,lastSuccessful);assert.match(f.node('clientLastRefresh').textContent,/Could not refresh/);
});
