const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('admin-dashboard.html','utf8');
const start=source.indexOf('async function repairClientAccess('),end=source.indexOf('\nasync function applyAdminConfigOverride(',start);
assert.ok(start>=0&&end>start);

function fixture(value){
  const email={value,setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},focus(){this.focused=true}};
  const messages=[],requests=[];
  const ctx=vm.createContext({
    document:{getElementById:id=>id==='adminRepairEmail'?email:null},
    currentAdminClient:{id:'ws-1',ownerEmail:'old@example.test'},adminTechSaving:false,adminClientSaving:false,adminClientOpenRequest:1,
    adminTechMessage:(message,error)=>messages.push({message,error}),confirm:()=>{throw Error('confirm must not run for invalid email')},
    String,fetch:(...args)=>{requests.push(args);throw Error('fetch must not run for invalid email')}
  });
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,email,messages,requests};
}

test('admin access repair email references its live feedback status',()=>{
  assert.match(html,/id="adminRepairEmail"[^>]*aria-describedby="adminTechStatus"/);
});

test('admin access repair rejects malformed owner email before confirmation or request',async()=>{
  const f=fixture('not-an-email');
  assert.equal(await vm.runInContext('repairClientAccess()',f.ctx),false);
  assert.equal(f.requests.length,0);
  assert.equal(f.email['aria-invalid'],'true');
  assert.equal(f.email.focused,true);
  assert.match(f.messages[0].message,/valid owner email/i);
  assert.equal(f.messages[0].error,true);
});
