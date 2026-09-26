const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const ui=fs.readFileSync('dashboard.js','utf8');
const start=ui.indexOf('const prospectStagePending=new Set();');
const end=ui.indexOf('\nfunction toLocalDateTimeInput(',start);
assert.ok(start>=0&&end>start,'Growth stage handler must exist');

function fixture({status=200,payload,wait=false}={}){
  const old={id:'lead-1',stage:'new',updatedAt:10,createdAt:1},requests=[],warnings=[];
  let release,renderCount=0,refreshes=0;
  const ctx=vm.createContext({
    adminWebsiteData:{prospects:[old]},
    renderGrowth:()=>{renderCount++},
    loadNotifications:()=>{},
    alert:message=>warnings.push(message),
    refreshAdminView:async(_view,opts)=>{refreshes++;assert.equal(opts.force,true)},
    fetch:async(url,options)=>{
      requests.push({url,options});
      if(wait)await new Promise(resolve=>{release=resolve});
      return {ok:status>=200&&status<300,status,json:async()=>payload||{prospect:{...old,stage:'qualified',updatedAt:11}}};
    },
    String,Number,Error,Set
  });
  vm.runInContext(ui.slice(start,end),ctx);
  return {ctx,old,requests,warnings,release:()=>release?.(),refreshes:()=>refreshes,renders:()=>renderCount,
    move:()=>vm.runInContext("moveGrowthProspectStage('lead-1','qualified')",ctx),
    setCurrent:x=>ctx.adminWebsiteData.prospects=[x]};
}
function flush(){return new Promise(resolve=>setImmediate(resolve))}

test('Growth applies confirmed stage to the refreshed current prospect, not detached stale item',async()=>{
  const f=fixture({wait:true});
  const saving=f.move();await flush();
  assert.equal(f.old.stage,'qualified');
  f.setCurrent({id:'lead-1',stage:'new',updatedAt:10,createdAt:1});
  f.release();await saving;
  assert.equal(f.ctx.adminWebsiteData.prospects[0].stage,'qualified');
  assert.equal(f.ctx.adminWebsiteData.prospects[0].updatedAt,11);
  assert.equal(f.requests.length,1);
  assert.equal(JSON.parse(f.requests[0].options.body).expectedUpdatedAt,10);
  assert.deepEqual(f.warnings,[]);
});

test('Growth never overwrites a refreshed prospect with a newer revision',async()=>{
  const f=fixture({wait:true});
  const saving=f.move();await flush();
  const newer={id:'lead-1',stage:'converted',updatedAt:15,createdAt:1};
  f.setCurrent(newer);f.release();await saving;
  assert.equal(newer.stage,'converted');
  assert.equal(newer.updatedAt,15);
});

test('failed Growth move does not roll back a newer or replaced record',async()=>{
  const f=fixture({status:503,payload:{error:'Unavailable'},wait:true});
  const saving=f.move();await flush();
  const newer={id:'lead-1',stage:'converted',updatedAt:15};
  f.setCurrent(newer);f.release();await saving;
  assert.equal(newer.stage,'converted');
  assert.deepEqual(f.warnings,['Unavailable']);
});
test('failed Growth move restores unchanged optimistic draft and prevents duplicate in-flight moves',async()=>{
  const f=fixture({status:503,payload:{error:'Unavailable'},wait:true});
  const saving=f.move();await flush();
  await f.move();
  assert.equal(f.requests.length,1);
  f.release();await saving;
  assert.equal(f.old.stage,'new');
  assert.equal(f.refreshes(),0);
});
test('conflicting Growth stage request refreshes authoritative server snapshot',async()=>{
  const f=fixture({status:409,payload:{error:'Stale revision'}});
  await f.move();
  assert.equal(f.old.stage,'new');
  assert.equal(f.refreshes(),1);
  assert.deepEqual(f.warnings,['Stale revision']);
});
test('incomplete success payload is not mistaken for confirmed stage change',async()=>{
  const f=fixture({payload:{ok:true}});
  await f.move();
  assert.equal(f.old.stage,'new');
  assert.match(f.warnings[0],/not confirmed/);
});
