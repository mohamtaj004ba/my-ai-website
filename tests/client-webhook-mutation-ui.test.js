const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const ui=fs.readFileSync('dashboard.js','utf8');
const start=ui.indexOf('async function saveWebhook(){');
const end=ui.indexOf('\nfunction settingsControlIds(',start);
assert.ok(start>=0&&end>start);
const block=ui.slice(start,end);

test('webhook save serializes requests and requires canonical receipt',()=>{
  assert.match(ui,/let webhookSaving=false/);
  assert.match(block,/if\(webhookSaving\)return false/);
  assert.match(block,/data\.ok!==true/);
  assert.match(block,/String\(confirmed\.webhookUrl\|\|'\'\)!==webhookUrl/);
  assert.match(block,/Number\.isFinite\(Number\(confirmed\.updatedAt\)\)/);
  assert.match(block,/finally\{webhookSaving=false;renderIntegrations\(\)\}/);
  assert.match(ui,/cancelWebhookButton[^\n]+if\(webhookSaving\)return/);
});

test('second webhook save is blocked while first request is pending',async()=>{
  let release,requests=0;
  const status={textContent:''},url={value:'https://example.test/hook'};
  const ctx=vm.createContext({
    webhookSaving:false,webhookEditing:true,integrationsData:{webhookUrl:''},demoMode:false,
    has:()=>true,openModal:()=>{},setWebhookEditing:()=>{},renderIntegrations:()=>{},
    document:{getElementById:id=>id==='webhookUrl'?url:id==='webhookEditStatus'?status:null},
    fetch:async()=>{requests++;await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>({ok:true,integrations:{webhookUrl:'https://example.test/hook',updatedAt:2}})}},
    String,Number,Object,Array,Promise,Error
  });
  vm.runInContext(block,ctx);
  const first=vm.runInContext('saveWebhook()',ctx);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(await vm.runInContext('saveWebhook()',ctx),false);
  assert.equal(requests,1);
  release();
  assert.equal(await first,true);
  assert.equal(ctx.integrationsData.webhookUrl,'https://example.test/hook');
  assert.equal(ctx.webhookSaving,false);
});

test('mismatched successful webhook receipt keeps the draft open',async()=>{
  const status={textContent:''},url={value:'https://example.test/hook'};
  const ctx=vm.createContext({
    webhookSaving:false,webhookEditing:true,integrationsData:{webhookUrl:'https://old.test/hook'},demoMode:false,
    has:()=>true,openModal:()=>{},setWebhookEditing:()=>{},renderIntegrations:()=>{},
    document:{getElementById:id=>id==='webhookUrl'?url:id==='webhookEditStatus'?status:null},
    fetch:async()=>({ok:true,json:async()=>({ok:true,integrations:{webhookUrl:'https://different.test/hook',updatedAt:2}})}),
    String,Number,Object,Array,Promise,Error
  });
  vm.runInContext(block,ctx);
  assert.equal(await vm.runInContext('saveWebhook()',ctx),false);
  assert.equal(ctx.webhookEditing,true);
  assert.equal(ctx.integrationsData.webhookUrl,'https://old.test/hook');
  assert.match(status.textContent,/incomplete/i);
});
