const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('api/account.js','utf8'),ui=fs.readFileSync('dashboard.js','utf8');
function segment(source,startText,endText){
  const begin=source.indexOf(startText),end=source.indexOf(endText,begin+startText.length);
  assert.ok(begin>=0&&end>begin,startText+' must exist');
  return source.slice(begin,end);
}
const endpoint=segment(api,'async function notifications(req,res){','\nasync function notificationsRead(',);
test('admin unread badge counts all notifications, even when list displays latest 80',async()=>{
  const items=Array.from({length:105},(_,i)=>({id:'notification-'+i,createdAt:i,title:'Alert '+i}));
  let result=null;
  const ctx=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),
    buildAdminNotifications:async()=>items,getNotificationReadSet:async()=>new Set(['notification-0','notification-1']),
    req:{query:{scope:'admin'}},
    res:{status(code){assert.equal(code,200);return this},json(data){result=data;return data}},
    Date,Number,Set,Array
  });
  vm.runInContext(endpoint,ctx);
  await vm.runInContext('notifications(req,res)',ctx);
  assert.equal(result.notifications.length,103,'older unread items remain visible beside recent history');
  assert.equal(result.unreadCount,103);
  assert.equal(result.notifications[0].id,'notification-104');
  assert.equal(result.notifications.at(-1).id,'notification-2');
});
test('client notification count and list stay within their respective authorization scope',async()=>{
  let clientCalls=0,adminCalls=0,output;
  const ctx=vm.createContext({
    requireSession:async()=>({workspaceId:'workspace-one',email:'client@example.test'}),
    requireAdmin:async()=>{adminCalls++;throw Error('Wrong scope')},
    buildClientNotifications:async()=>{clientCalls++;return [{id:'a',createdAt:3},{id:'b',createdAt:2}]},
    getNotificationReadSet:async(scope,email,ws)=>{assert.equal(scope,'client');assert.equal(ws,'workspace-one');return new Set(['a'])},
    req:{query:{scope:'client'}},
    res:{status(code){assert.equal(code,200);return this},json(data){output=data;return data}},
    Date,Number,Set,Array
  });
  vm.runInContext(endpoint,ctx);
  await vm.runInContext('notifications(req,res)',ctx);
  assert.equal(output.unreadCount,1);
  assert.equal(output.notifications[0].read,true);
  assert.equal(clientCalls,1);assert.equal(adminCalls,0);
});
function pending(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve}}
function fixture({unreadCount=95,visible=80}={}){
  const renders=[],network=[];
  const payload=()=>({notifications:Array.from({length:visible},(_,i)=>({id:'alert-'+i,read:false})),unreadCount});
  const ctx=vm.createContext({
    demoMode:false,notificationsLoading:false,notificationRequest:0,
    notificationUnreadCount:unreadCount,notificationData:payload().notifications,
    notificationLoadError:'',notificationLastSyncAt:0,
    notificationScope:()=> 'admin',
    document:{getElementById:()=>({})},
    fetch:async(url,options)=>{
      network.push(url);
      return {ok:true,json:async()=>payload()};
    },
    renderNotifications:()=>renders.push('render'),console:{error(){},warn(){}},
    Set,Number,Math,Array
  });
  vm.runInContext(segment(ui,'async function loadNotifications(','\nfunction renderNotifications('),ctx);
  vm.runInContext(segment(ui,'async function markNotifications(','\nasync function navigateNotification('),ctx);
  vm.runInContext(segment(ui,'async function markAllNotifications(','\nfunction initNotifications('),ctx);
  return {ctx,renders,network,run:s=>vm.runInContext(s,ctx)};
}
test('reading a visible alert decrements full unread total without discarding off-page alerts',async()=>{
  const f=fixture();
  assert.equal(await f.run("markNotifications(['alert-0'])"),true);
  assert.equal(f.ctx.notificationUnreadCount,94);
  assert.equal(f.ctx.notificationData[0].read,true);
  assert.equal(await f.run("markNotifications(['alert-0'])"),true);
  assert.equal(f.ctx.notificationUnreadCount,94,'repeated read must not decrement twice');
});
test('reading all clears count even when API displayed only 80 of 95 alerts',async()=>{
  const f=fixture();
  assert.equal(await f.run('markAllNotifications()'),true);
  assert.equal(f.ctx.notificationUnreadCount,0);
  assert.ok(f.ctx.notificationData.every(x=>x.read));
});
test('late initial list response cannot resurrect notification already marked read',async()=>{
  const f=fixture(),p=pending();
  f.ctx.fetch=async(url)=>url.includes('notifications-read')?{ok:true}:p.promise;
  const load=f.run('loadNotifications()');
  await f.run("markNotifications(['alert-0'])");
  assert.equal(f.ctx.notificationUnreadCount,94);
  p.resolve({ok:true,json:async()=>({notifications:[{id:'alert-0',read:false}],unreadCount:95})});
  await load;
  assert.equal(f.ctx.notificationUnreadCount,94);
  assert.equal(f.ctx.notificationData[0].read,true);
  assert.equal(f.ctx.notificationsLoading,false);
});
test('late list response cannot restore unread count after mark-all',async()=>{
  const f=fixture(),p=pending();
  f.ctx.fetch=async(url)=>url.includes('notifications-read-all')?{ok:true}:p.promise;
  const load=f.run('loadNotifications()');
  await f.run('markAllNotifications()');
  p.resolve({ok:true,json:async()=>({notifications:[{id:'alert-0',read:false}],unreadCount:95})});
  await load;
  assert.equal(f.ctx.notificationUnreadCount,0);
  assert.equal(f.ctx.notificationData[0].read,true);
});
test('invalid notification JSON cannot overwrite last verified list or count',async()=>{
  const f=fixture();
  f.ctx.fetch=async()=>({ok:true,status:200,json:async()=>({notifications:{not:'an array'},unreadCount:'bad'})});
  await f.run('loadNotifications()');
  assert.equal(f.ctx.notificationUnreadCount,95);
  assert.equal(f.ctx.notificationData.length,80);
  assert.equal(f.ctx.notificationLoadError,'Refresh failed — showing the last verified alerts.');
  assert.equal(f.ctx.notificationLastSyncAt,0);
  assert.equal(f.ctx.notificationsLoading,false);
});

test('failed notification refresh preserves last verified alerts and explicitly marks them stale',async()=>{
  const f=fixture();
  f.ctx.fetch=async()=>({ok:false,status:503,json:async()=>({error:'unavailable'})});
  await f.run('loadNotifications()');
  assert.equal(f.ctx.notificationUnreadCount,95);
  assert.equal(f.ctx.notificationData.length,80);
  assert.equal(f.ctx.notificationData[0].id,'alert-0');
  assert.equal(f.ctx.notificationLoadError,'Refresh failed — showing the last verified alerts.');
  assert.equal(f.ctx.notificationLastSyncAt,0);
});

test('successful notification refresh clears stale warning and records a fresh sync time',async()=>{
  const f=fixture({unreadCount:2,visible:2});
  f.ctx.notificationLoadError='Refresh failed — showing the last verified alerts.';
  await f.run('loadNotifications()');
  assert.equal(f.ctx.notificationLoadError,'');
  assert.ok(Number(f.ctx.notificationLastSyncAt)>0);
  assert.equal(f.ctx.notificationUnreadCount,2);
  assert.equal(f.ctx.notificationData.length,2);
});

test('older unread alerts appear even if newest 80 alerts have already been read',async()=>{
  const items=Array.from({length:200},(_,i)=>({id:'notification-'+i,createdAt:i,title:'Alert '+i}));
  let result=null;
  const ctx=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),
    buildAdminNotifications:async()=>items,
    getNotificationReadSet:async()=>new Set(Array.from({length:80},(_,i)=>'notification-'+(120+i))),
    req:{query:{scope:'admin'}},
    res:{status(code){assert.equal(code,200);return this},json(data){result=data;return data}},
    Date,Number,Set,Array
  });
  vm.runInContext(endpoint,ctx);
  await vm.runInContext('notifications(req,res)',ctx);
  assert.equal(result.unreadCount,120);
  assert.equal(result.notifications.length,160,'bounded newest history plus older unread work');
  assert.equal(result.notifications.filter(x=>!x.read).length,80);
  assert.equal(result.notifications[0].id,'notification-199');
  assert.equal(result.notifications.at(-1).id,'notification-40');
});
