'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const block=(name,next)=>source.slice(source.indexOf('async function '+name+'('),source.indexOf('\n'+next,source.indexOf('async function '+name+'(')));
function fixture({get='success',read=true}={}){
 let resolve;const gate=new Promise(r=>resolve=r),renders=[],calls=[];
 const c={demoMode:false,notificationsLoading:false,notificationRequest:0,notificationMode:'history',notificationData:[{id:'a',read:false,title:'Current alert'}],notificationUnreadCount:1,notificationLoadError:'',notificationReadError:'',notificationLastSyncAt:123,notificationCoverage:{},document:{getElementById:()=>({})},notificationScope:()=> 'client',console:{warn(){},error(){}},renderNotifications(){renders.push({loading:c.notificationsLoading,disabled:c.notificationsLoading,mode:c.notificationMode});},async fetch(url,options){calls.push(options?.method||'GET');if(options?.method==='POST')return{ok:read,status:read?200:503,json:async()=>({ok:read})};await gate;if(get==='error')throw Error('offline');return{ok:true,json:async()=>get==='malformed'?{}:{notifications:[{id:'a',read:false,title:'Stale alert'}],unreadCount:1}};}};
 vm.createContext(c);vm.runInContext(block('loadNotifications','function renderNotifications')+'\n'+block('markNotifications','async function navigateNotification'),c);
 return{c,renders,calls,release:resolve};
}
for(const get of ['success','error','malformed'])test('read mutation fences '+get+' refresh and releases rendered busy controls',async()=>{
 const f=fixture({get}),pending=f.c.loadNotifications();await f.c.markNotifications(['a']);f.release();await pending;
 a.equal(f.c.notificationsLoading,false);a.equal(f.renders.at(-1).disabled,false);a.equal(f.c.notificationData[0].read,true);a.equal(f.c.notificationData[0].title,'Current alert');a.equal(f.c.notificationUnreadCount,0);a.equal(f.c.notificationLastSyncAt,123);a.equal(f.c.notificationLoadError,'');a.equal(f.c.notificationMode,'history');a.deepEqual(f.calls,['GET','POST']);
});
for(const get of ['success','error','malformed'])test('failed read mutation preserves authoritative '+get+' refresh and controls',async()=>{
 const f=fixture({get,read:false}),pending=f.c.loadNotifications();a.equal(await f.c.markNotifications(['a']),false);f.release();await pending;
 a.equal(f.renders.at(-1).disabled,false);a.equal(f.c.notificationData[0].read,false);a.equal(f.c.notificationUnreadCount,1);if(get==='success'){a.equal(f.c.notificationData[0].title,'Stale alert');a(f.c.notificationLastSyncAt>123);}else{a.match(f.c.notificationLoadError,/Refresh failed/);a.equal(f.c.notificationLastSyncAt,123);}
});
test('duplicate refresh is not dispatched and rendering preserves current tab without result mutation',async()=>{
 const f=fixture(),first=f.c.loadNotifications();await f.c.loadNotifications();a.deepEqual(f.calls,['GET']);f.release();await first;a.equal(f.c.notificationMode,'history');a.equal(f.renders.at(-1).loading,false);
});
