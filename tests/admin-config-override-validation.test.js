const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('admin-dashboard.html','utf8');
const start=source.indexOf('async function applyAdminConfigOverride('),end=source.indexOf('\nasync function restoreAdminAudit(',start);
assert.ok(start>=0&&end>start);

test('admin config editor references live feedback status',()=>{
  assert.match(html,/id="adminConfigEditor"[^>]*aria-describedby="adminTechStatus"/);
});

test('invalid admin override JSON is marked and focused before confirmation or request',async()=>{
  const editor={value:'{bad json',setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},focus(){this.focused=true}};
  const section={value:'settings'},messages=[],requests=[];
  const ctx=vm.createContext({
    document:{getElementById:id=>id==='adminConfigEditor'?editor:id==='adminConfigSection'?section:null},
    currentAdminClient:{id:'ws-1'},adminTechSaving:false,
    adminTechMessage:(message,error)=>messages.push({message,error}),
    confirm:()=>{throw Error('confirm must not run for invalid JSON')},
    JSON,fetch:(...args)=>{requests.push(args);throw Error('fetch must not run for invalid JSON')}
  });
  vm.runInContext(source.slice(start,end),ctx);
  assert.equal(await vm.runInContext('applyAdminConfigOverride()',ctx),false);
  assert.equal(requests.length,0);
  assert.equal(editor['aria-invalid'],'true');
  assert.equal(editor.focused,true);
  assert.match(messages[0].message,/JSON is invalid/i);
  assert.equal(messages[0].error,true);
});
