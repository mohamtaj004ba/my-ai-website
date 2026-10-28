const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('async function loadAdminTechSupport(');
const end=source.indexOf('\nfunction renderAdminTechSupport(',begin);
assert.ok(begin>=0&&end>begin);
function fixture(response,{id='workspace-1',request=1}={}){
  const messages=[],renders=[];
  const context=vm.createContext({
    currentAdminClient:{id},adminClientOpenRequest:request,currentAdminTech:{diagnostics:{workspaceId:id,ownerEmail:'prior@example.test'}},
    fetch:async()=>{if(response instanceof Error)throw response;return response},
    adminTechMessage:(message,error)=>messages.push({message,error:!!error}),
    renderAdminTechSupport:()=>renders.push('render'),
    encodeURIComponent,String,Array
  });
  vm.runInContext(source.slice(begin,end),context);
  return {context,messages,renders,run:()=>vm.runInContext('loadAdminTechSupport("workspace-1",1)',context)};
}
test('network failure leaves client drawer responsive and shows diagnostic warning',async()=>{
  const f=fixture(new Error('Network unavailable'));
  await assert.doesNotReject(f.run());
  assert.match(f.messages.at(-1).message,/temporarily unavailable/);
  assert.equal(f.messages.at(-1).error,true);
  assert.equal(f.context.currentAdminTech.diagnostics.ownerEmail,'prior@example.test');
  assert.equal(f.renders.length,0);
});
test('malformed successful diagnostics cannot be mislabeled refreshed',async()=>{
  const f=fixture({ok:true,json:async()=>({diagnostics:{workspaceId:'workspace-1'}})});
  await f.run();
  assert.match(f.messages.at(-1).message,/incomplete data/);
  assert.equal(f.messages.at(-1).error,true);
  assert.equal(f.renders.length,0);
});
test('diagnostics for a different workspace cannot replace selected client diagnostics',async()=>{
  const f=fixture({ok:true,json:async()=>({diagnostics:{workspaceId:'workspace-other'},audit:[]})});
  await f.run();
  assert.match(f.messages.at(-1).message,/incomplete data/);
  assert.equal(f.context.currentAdminTech.diagnostics.ownerEmail,'prior@example.test');
});
test('well-formed matching diagnostics still render normally',async()=>{
  const payload={diagnostics:{workspaceId:'workspace-1'},audit:[]};
  const f=fixture({ok:true,json:async()=>payload});
  await f.run();
  assert.equal(f.context.currentAdminTech,payload);
  assert.deepEqual(f.renders,['render']);
  assert.equal(f.messages.at(-1).message,'Diagnostics refreshed.');
});
test('stale diagnostics failure does not replace newer client status',async()=>{
  const f=fixture(new Error('Network unavailable'));
  f.context.adminClientOpenRequest=2;
  await f.run();
  assert.equal(f.messages.length,1);
  assert.equal(f.messages[0].message,'Running diagnostics…');
  assert.equal(f.renders.length,0);
});
