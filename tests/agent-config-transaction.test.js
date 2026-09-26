const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {clientRouting}=require('../lib/voice-status');
const {compareAndSetConfig}=require('../lib/config-transaction');
const source=fs.readFileSync('api/account.js','utf8');
const handler=source.slice(source.indexOf('async function saveAgent('),source.indexOf('async function automations('));
function fixture(body,{transaction=true}={}){
  const records={'agent:tenant':{name:'Maya',health:'ready',providerId:'retained',transferNumber:'5550100',updatedAt:10},'phone:index':[{id:'p',workspaceId:'tenant',transferNumber:'5550100',number:'5550101'}],'routing-request:tenant':{transferNumber:'5550100'}};
  let result,status=200,updates;
  const ctx=vm.createContext({requireWritableSession:async()=>({workspaceId:'tenant',email:'qa@test.invalid'}),requireOperationalWorkspace:async()=>true,kv:{get:async k=>records[k],set:()=>assert.fail('Use atomic writes')},compareAndSetConfig:async(_,u)=>{updates=u;return transaction},clientRouting,appendAudit:async()=>{},process:{env:{}},safeError:()=>'',console:{error:()=>{}},req:{body},res:{status(n){status=n;return this},json(x){result=x}}});
  vm.runInContext(handler,ctx);
  return {run:async()=>{await vm.runInContext('saveAgent(req,res)',ctx);return {result,status,updates}}};
}
test('section saves preserve unrelated agent fields and internal metadata',async()=>{
  const {result,status,updates}=await fixture({section:'identity',name:'New name',transferNumber:'5559999',expectedUpdatedAt:10}).run();
  assert.equal(status,200);assert.equal(result.agent.name,'New name');assert.equal(result.agent.providerId,'retained');assert.equal(result.agent.transferNumber,'5550100');assert.equal(updates.length,1);
});
test('transfer update stages agent and both routing records together',async()=>{
  const {updates}=await fixture({section:'knowledge',transferNumber:'5550199',expectedUpdatedAt:10}).run();
  assert.deepEqual(Array.from(updates,x=>x.key),['agent:tenant','phone:index','routing-request:tenant']);
  assert.equal(updates[1].before[0].transferNumber,'5550100');assert.equal(updates[1].after[0].transferNumber,'5550199');
});
test('stale forms and concurrent storage changes fail closed',async()=>{
  let r=await fixture({expectedUpdatedAt:9}).run();assert.equal(r.status,409);assert.equal(r.updates,undefined);
  r=await fixture({section:'identity',expectedUpdatedAt:10},{transaction:false}).run();assert.equal(r.status,409);assert.equal(r.result.code,'CONFIG_CONFLICT');
});
test('atomic helper passes all snapshots and writes in one server-side operation',async()=>{
  let calls=0;
  assert.equal(await compareAndSetConfig({eval:async(script,keys,args)=>{calls++;assert.match(script,/GET/);assert.match(script,/SET/);assert.deepEqual(keys,['agent:a','phone:index']);assert.deepEqual(args,['','{"name":"A"}','[]','[]']);return 1}},[{key:'agent:a',before:null,after:{name:'A'}},{key:'phone:index',before:[],after:[]}]),true);
  assert.equal(calls,1);
  assert.equal(await compareAndSetConfig({eval:async()=>0},[{key:'a',before:null,after:{}}]),false);
});
