const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const saveBegin=source.indexOf('async function saveNotificationReadSet(');
const saveEnd=source.indexOf('\nfunction notificationItem(',saveBegin);
const readBegin=source.indexOf('async function notificationsReadAll(');
const readEnd=source.indexOf('\nfunction userProfileKey(',readBegin);
assert.ok(saveBegin>=0&&saveEnd>saveBegin&&readBegin>=0&&readEnd>readBegin);
function fixture(){
  const writes=[];
  const ctx=vm.createContext({
    notificationReadKey:()=> 'notifications:admin:test',
    kv:{set:async(key,list,opts)=>writes.push({key,list,opts})},
    requireAdmin:async()=>({email:'admin@example.test'}),
    buildAdminNotifications:async()=>[],
    getNotificationReadSet:async()=>new Set(),
    req:{body:{scope:'admin'}},
    res:{status(code){assert.equal(code,200);return this},json(value){return value}},
    Set,Array,String,Number,Date
  });
  vm.runInContext(source.slice(saveBegin,saveEnd),ctx);
  vm.runInContext(source.slice(readBegin,readEnd),ctx);
  return {ctx,writes};
}
test('read-all persists more than 500 active admin alert IDs',async()=>{
  const f=fixture(),items=Array.from({length:1600},(_,i)=>({id:'alert-'+i}));
  f.ctx.buildAdminNotifications=async()=>items;
  await vm.runInContext('notificationsReadAll(req,res)',f.ctx);
  assert.equal(f.writes.length,1);
  assert.equal(f.writes[0].list.length,1600);
  assert.equal(new Set(f.writes[0].list).size,1600);
  assert.equal(f.writes[0].list[0],'alert-0');
  assert.equal(f.writes[0].list.at(-1),'alert-1599');
  assert.equal(f.writes[0].opts.ex,60*60*24*365);
});
test('read receipt retention remains bounded and deduplicated',async()=>{
  const f=fixture(),ids=Array.from({length:2200},(_,i)=>'alert-'+i);
  await vm.runInContext('saveNotificationReadSet("admin","admin@example.test","",ids)',vm.createContext({...f.ctx,ids}));
  assert.equal(f.writes[0].list.length,2000);
  assert.equal(f.writes[0].list[0],'alert-200');
  assert.equal(f.writes[0].list.at(-1),'alert-2199');
  await vm.runInContext('saveNotificationReadSet("admin","admin@example.test","",ids.concat(ids.at(-1)))',vm.createContext({...f.ctx,ids}));
  assert.equal(f.writes[1].list.length,2000);
});
