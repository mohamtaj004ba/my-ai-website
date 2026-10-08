const test=require('node:test'),assert=require('node:assert/strict');const {download}=require('../workspace-export-download');
const data={exportVersion:'1.0',workspace:{id:'test'},voice:{version:1}};
function fixture(){const statuses=[],links=[],timers=[],revoked=[],button={disabled:false};let made=0;return {statuses,links,timers,revoked,button,get made(){return made},options:{document:{body:{append(link){links.push(link)}},createElement(){return {click(){this.clicked=true},remove(){this.removed=true}}}},URL:{createObjectURL(){made++;return 'blob:fixture'},revokeObjectURL(u){revoked.push(u)}},Blob,schedule(fn){timers.push(fn);return 0}}}}
test('workspace export creates a private JSON download without navigating away',async()=>{
  const f=fixture(),ok=await download({url:'/api/account?action=workspace-export',button:f.button,status:t=>f.statuses.push(t)},{...f.options,fetchImpl:async(url,options)=>{assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');return {ok:true,json:async()=>data,headers:{get:()=> 'attachment; filename="CallerCore-export-test.json"'}}}});
  assert.equal(ok,true);assert.equal(f.links[0].download,'CallerCore-export-test.json');assert.equal(f.links[0].clicked,true);assert.equal(f.links[0].removed,true);assert.equal(f.button.disabled,false);f.timers[1]();assert.deepEqual(f.revoked,['blob:fixture']);
});
test('failed or malformed export creates no file and restores the control',async()=>{
  for(const response of [{ok:false,status:503},{ok:false,status:401},{ok:false,status:403},{ok:true,json:async()=>({})},{ok:true,json:async()=>{throw Error('private')}}]){
    const f=fixture();assert.equal(await download({url:'fixture',button:f.button,status:t=>f.statuses.push(t)},{...f.options,fetchImpl:async()=>response}),false);assert.equal(f.made,0);assert.equal(f.button.disabled,false);assert.ok(!f.statuses.join('').includes('private'));
  }
});
test('export does not deliver or write status for a workspace that changed during the request',async()=>{
  const f=fixture();let current=true;const ok=await download({url:'fixture',button:f.button,current:()=>current,status:t=>f.statuses.push(t)},{...f.options,fetchImpl:async()=>{current=false;return {ok:true,json:async()=>data}}});
  assert.equal(ok,false);assert.equal(f.made,0);assert.equal(f.statuses.length,1);assert.equal(f.button.disabled,false);
});
test('download deduplicates a pending click and suppresses private transport errors',async()=>{
  const f=fixture();let finish,requests=0;const options={...f.options,fetchImpl:async()=>{requests++;return new Promise((resolve,reject)=>{finish=reject})}},input={url:'fixture',button:f.button,status:t=>f.statuses.push(t)};
  const pending=download(input,options);assert.equal(await download(input,options),false);finish(Error('private provider body'));assert.equal(await pending,false);assert.equal(requests,1);assert.ok(!f.statuses.join('').includes('private'));
});
