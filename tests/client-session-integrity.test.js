const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const start=source.indexOf('async function session('),end=source.indexOf('\nfunction redactExportSecrets(',start);
assert.ok(start>=0&&end>start,'session handler exists');
const code=source.slice(start,end);

async function run(values={}){
  let status=200,payload;
  const workspaceId='ws-1',email='owner@example.test';
  const ctx=vm.createContext({
    requireSession:async()=>({workspaceId,email,role:'owner',adminView:false}),
    kv:{get:async key=>{
      if(key==='workspace:'+workspaceId)return values.workspace===undefined?{id:workspaceId,name:'Test',plan:'Growth',status:'active',usage:{minutes:5}}:values.workspace;
      if(key==='user:email:'+email)return values.member===undefined?{workspaceId,email,role:'owner'}:values.member;
      if(key==='onboarding:workspace:'+workspaceId)return values.onboarding===undefined?null:values.onboarding;
      if(key==='onboarding:workspace-token:'+workspaceId)return values.token===undefined?null:values.token;
      return null;
    }},
    entitlementsFor:plan=>({plan,locations:2,features:{}}),
    cleanEmail:v=>String(v).toLowerCase(),
    getUserProfile:async()=>({displayName:'Owner',avatarDataUrl:'',updatedAt:0}),
    clientOnboardingView:(state,extra)=>({status:state?.status||'',needsCompletion:!!extra.needsCompletion,url:extra.url||''}),
    req:{},res:{status(n){status=n;return this},json(x){payload=x;return x}},
    Array,Object,String,Number
  });
  vm.runInContext(code,ctx);
  await vm.runInContext('session(req,res)',ctx);
  return {status,payload};
}

test('session handler rejects malformed workspace and usage records instead of inventing healthy defaults',async()=>{
  assert.equal((await run({workspace:{id:'wrong',plan:'Growth'}})).status,503);
  assert.equal((await run({workspace:{id:'ws-1',plan:'Growth',usage:'bad'}})).status,503);
  assert.equal((await run({workspace:{id:'ws-1',plan:'Growth',usage:{minutes:-1}}})).status,503);
});

test('session handler rejects malformed membership and onboarding sources',async()=>{
  assert.equal((await run({member:'owner'})).status,503);
  assert.equal((await run({onboarding:[]})).status,503);
  assert.equal((await run({token:{bad:true}})).status,503);
});

test('session handler returns a verified workspace identity for healthy records',async()=>{
  const out=await run({onboarding:{status:'intake_complete'},token:'token'});
  assert.equal(out.status,200);
  assert.equal(out.payload.workspace.id,'ws-1');
  assert.equal(out.payload.user.email,'owner@example.test');
  assert.equal(out.payload.user.role,'owner');
  assert.equal(out.payload.onboarding.needsCompletion,false);
});

test('session bootstrap rejects malformed onboarding checklist instead of showing an empty checklist',()=>{
  const start=source.indexOf('async function session('),end=source.indexOf('\nfunction redactExportSecrets(',start),block=source.slice(start,end);
  assert.match(block,/Onboarding checklist data is unavailable\. No incomplete checklist was substituted/);
});

test('session bootstrap rejects blank persisted onboarding token mappings',async()=>{
  const out=await run({onboarding:{status:'awaiting_agreement'},token:'   '});
  assert.equal(out.status,503);
  assert.match(out.payload.error,/Onboarding session token is unavailable/);
});
