'use strict';
// Fixed guest program preparation only. No source evaluation or VM provisioning here.
const {createHash}=require('node:crypto');
const hash=s=>createHash('sha256').update(s).digest('hex');
const HASHES=Object.freeze({baseline:'c812f5c62121e503ecd0946f7ca6d09eeac1a1147b4110d7dbc5c50493146cef',patched:'a79132d86e64401a08623ceed9cdbcd31371386a8bb0774f29d7004eb6ba47df'});
const BEFORE='  finally{notificationsLoading=false;if(request===notificationRequest)renderNotifications()}',AFTER='  finally{notificationsLoading=false;renderNotifications()}';
const TESTS=Object.freeze(['baseline-reproduces-stuck-notification-controls','patched-success-releases-current-controls','patched-error-releases-current-controls','patched-malformed-releases-current-controls','failed-read-preserves-refresh-result','duplicate-refresh-not-dispatched','newer-read-keeps-sync-time-and-tab']);
function extract(source,name,next){
 const start='async function '+name+'(',end='\n'+next,a=source.indexOf(start),b=source.indexOf(end,a);
 if(a<0||b<=a||a!==source.lastIndexOf(start))throw Error('NOTIFICATION_SOURCE_BOUNDARY');
 return source.slice(a,b);
}
function buildProgram(input){
 if(arguments.length!==1||!input||Object.keys(input).sort().join(',')!=='baseline,patched')throw Error('NOTIFICATION_INPUT_DENIED');
 const {baseline,patched}=input;
 if([baseline,patched].some(s=>typeof s!=='string'||Buffer.byteLength(s)>700000)||hash(baseline)!==HASHES.baseline||hash(patched)!==HASHES.patched)throw Error('NOTIFICATION_SOURCE_IDENTITY');
 if(baseline.indexOf(BEFORE)<0||baseline.indexOf(BEFORE)!==baseline.lastIndexOf(BEFORE)||baseline.replace(BEFORE,AFTER)!==patched)throw Error('NOTIFICATION_PATCH_SCOPE');
 const extractBoth=s=>extract(s,'loadNotifications','function renderNotifications')+'\n'+extract(s,'markNotifications','async function navigateNotification');
 const program='('+guestProgram.toString()+')('+JSON.stringify({baseline:extractBoth(baseline),patched:extractBoth(patched)})+');';
 return{version:'notification-source-behavioral-tests-v1',sourceHashes:{...HASHES},program,programSha256:hash(program),timeoutMs:15000,maxOutputBytes:16000,requiresQualifiedOsSandbox:true,executionAuthorized:false,generatedCodeExecutionAllowed:false,qualification:'Fixed historical source functions and fictional requests only. Preparation does not execute source or qualify isolation.'};
}
// Serialized for an independently qualified OS sandbox. Never called by this module.
async function guestProgram(sources){
 const vm=require('node:vm'),a=require('node:assert/strict'),results=[];
 function fixture(source,{get='success',read=true}={}){
  let release;const gate=new Promise(r=>release=r),renders=[],calls=[];
  const c={demoMode:false,notificationsLoading:false,notificationRequest:0,notificationMode:'history',notificationData:[{id:'fictional',read:false,title:'Current alert'}],notificationUnreadCount:1,notificationLoadError:'',notificationReadError:'',notificationLastSyncAt:123,notificationCoverage:{},document:{getElementById:()=>({})},notificationScope:()=> 'client',console:{warn(){},error(){}},renderNotifications(){renders.push({loading:c.notificationsLoading,mode:c.notificationMode});},async fetch(url,options){a(['GET','POST'].includes(options?.method||'GET'));a(url==='/api/account?action=notifications&scope=client'||url==='/api/account?action=notifications-read');calls.push(options?.method||'GET');if(options?.method==='POST')return{ok:read,status:read?200:503,json:async()=>({ok:read})};await gate;if(get==='error')throw Error('FICTIONAL_OFFLINE');return{ok:true,json:async()=>get==='malformed'?{}:{notifications:[{id:'fictional',read:false,title:'Stale alert'}],unreadCount:1}};}};
  vm.createContext(c);vm.runInContext(source,c,{timeout:250});return{c,renders,calls,release};
 }
 async function race(source,options){const f=fixture(source,options),pending=f.c.loadNotifications();await f.c.markNotifications(['fictional']);f.release();await pending;return f;}
 async function check(id,fn){let timer;try{await Promise.race([fn(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('FIXED_TEST_TIMEOUT')),1500);})]);results.push({id,passed:true});}catch{results.push({id,passed:false});}finally{clearTimeout(timer);}}
 await check('baseline-reproduces-stuck-notification-controls',async()=>{const f=await race(sources.baseline,{});a.equal(f.c.notificationsLoading,false);a.equal(f.renders.at(-1).loading,true);});
 for(const get of ['success','error','malformed'])await check('patched-'+get+'-releases-current-controls',async()=>{const f=await race(sources.patched,{get});a.equal(f.renders.at(-1).loading,false);a.equal(f.c.notificationData[0].read,true);a.equal(f.c.notificationData[0].title,'Current alert');a.equal(f.c.notificationUnreadCount,0);a.equal(f.c.notificationLoadError,'');});
 await check('failed-read-preserves-refresh-result',async()=>{for(const get of ['success','error','malformed']){const f=await race(sources.patched,{get,read:false});a.equal(f.renders.at(-1).loading,false);a.equal(f.c.notificationData[0].read,false);a.equal(f.c.notificationUnreadCount,1);if(get==='success')a.equal(f.c.notificationData[0].title,'Stale alert');else a.match(f.c.notificationLoadError,/Refresh failed/);}});
 await check('duplicate-refresh-not-dispatched',async()=>{const f=fixture(sources.patched),p=f.c.loadNotifications();await f.c.loadNotifications();a.deepEqual(f.calls,['GET']);f.release();await p;a.equal(f.renders.at(-1).loading,false);});
 await check('newer-read-keeps-sync-time-and-tab',async()=>{const f=await race(sources.patched,{});a.equal(f.c.notificationLastSyncAt,123);a.equal(f.c.notificationMode,'history');a.deepEqual(f.calls,['GET','POST']);});
 const passed=results.every(x=>x.passed);process.stdout.write(JSON.stringify({version:'notification-source-behavioral-result-v1',fixtureDataOnly:true,tests:results,passed,qualified:false,publicationAuthorized:false})+'\n');process.exitCode=passed?0:1;
}
if(require.main===module)throw Error('NOTIFICATION_GUEST_REQUIRES_QUALIFIED_DISPATCHER');
module.exports={buildProgram,HASHES,TESTS};
