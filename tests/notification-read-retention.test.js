const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {addBoundedIds}=require('../lib/bounded-id-set');
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
    addBoundedIds,
    kv:{eval:async(_script,keys,args)=>{writes.push({keys,args});return args.length-2}},
    requireAdmin:async()=>({email:'admin@example.test'}),
    buildAdminNotifications:async()=>[],
    safeError:()=>'',console:{error:()=>{}},
    req:{body:{scope:'admin'}},
    res:{status(code){assert.equal(code,200);return this},json(value){return value}},
    Set,Array,String,Number,Date
  });
  vm.runInContext(source.slice(saveBegin,saveEnd),ctx);
  vm.runInContext(source.slice(readBegin,readEnd),ctx);
  return {ctx,writes};
}

test('read-all persists more than 500 active admin alert IDs through one atomic merge',async()=>{
  const f=fixture(),items=Array.from({length:1600},(_,i)=>({id:'alert-'+i}));
  f.ctx.buildAdminNotifications=async()=>items;
  await vm.runInContext('notificationsReadAll(req,res)',f.ctx);
  assert.equal(f.writes.length,1);
  assert.deepEqual(f.writes[0].keys,['notifications:admin:test']);
  assert.equal(f.writes[0].args[0],'2000');
  assert.equal(f.writes[0].args[1],String(60*60*24*365));
  const ids=f.writes[0].args.slice(2);
  assert.equal(ids.length,1600);
  assert.equal(new Set(ids).size,1600);
  assert.equal(ids[0],'alert-0');
  assert.equal(ids.at(-1),'alert-1599');
});

test('read receipt retention remains bounded and deduplicated before the atomic Redis merge',async()=>{
  const f=fixture(),ids=Array.from({length:2200},(_,i)=>'alert-'+i);
  await vm.runInContext('saveNotificationReadSet("admin","admin@example.test","",ids)',vm.createContext({...f.ctx,ids}));
  let saved=f.writes[0].args.slice(2);
  assert.equal(saved.length,2000);
  assert.equal(saved[0],'alert-200');
  assert.equal(saved.at(-1),'alert-2199');
  await vm.runInContext('saveNotificationReadSet("admin","admin@example.test","",ids.concat(ids.at(-1)))',vm.createContext({...f.ctx,ids}));
  saved=f.writes[1].args.slice(2);
  assert.equal(saved.length,2000);
  assert.equal(new Set(saved).size,2000);
});

test('stored notification read receipts require unique bounded canonical ids',()=>{
  const account=fs.readFileSync('api/account.js','utf8');
  const start=account.indexOf('async function getNotificationReadSet('),end=account.indexOf('\nasync function saveNotificationReadSet(',start),block=account.slice(start,end);
  assert.match(block,/raw\.length>2000/);
  assert.match(block,/typeof id!=='string'/);
  assert.match(block,/id\.length>220/);
  assert.match(block,/new Set\(raw\)\.size!==raw\.length/);
});
test('notification read endpoint rejects malformed ids instead of coercing them to strings',()=>{
  const account=fs.readFileSync('api/account.js','utf8');
  const start=account.indexOf('async function notificationsRead('),end=account.indexOf('\nasync function notificationsReadAll(',start),block=account.slice(start,end);
  assert.match(block,/Notification IDs are invalid\. Read state was not changed/);
  assert.doesNotMatch(block,/req\.body\.ids\.map\(x=>String\(x\)/);
  assert.match(block,/new Set\(rawIds\)\.size!==rawIds\.length/);
});
