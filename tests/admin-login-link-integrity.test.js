const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync('api/account.js','utf8');
const start=source.indexOf('async function adminSendClientLogin('),end=source.indexOf('\nasync function adminForceLogout(',start);
assert.ok(start>=0&&end>start);
const code=source.slice(start,end);

async function run({workspace={id:'client-1',ownerEmail:'owner@example.test'},member={workspaceId:'client-1',role:'owner',sessionVersion:2},persist=true}={}){
  let status=200,payload,mails=0,audits=0;
  const store=new Map([['workspace:client-1',workspace],['user:email:owner@example.test',member]]);
  const ctx=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),cleanEmail:v=>String(v||'').trim().toLowerCase(),
    kv:{get:async k=>store.get(k)??null,set:async(k,v)=>{if(persist)store.set(k,v);return 'OK'}},
    crypto,loginTokenKey:t=>'login:v2:'+crypto.createHash('sha256').update(t).digest('hex'),
    requestOrigin:()=> 'https://preview.example.test',authEmail:()=>({}),sendMail:async()=>{mails++},
    appendAudit:async()=>{audits++},safeError:()=>'',console:{error(){}},process:{env:{}},encodeURIComponent,
    req:{body:{id:'client-1'}},res:{status(n){status=n;return this},json(v){payload=v;return v}},
    Array,Object,String,Number,Error
  });
  vm.runInContext(code,ctx);await vm.runInContext('adminSendClientLogin(req,res)',ctx);
  return {status,payload,mails,audits,store};
}

test('admin sign-in link rejects malformed workspace or member records',async()=>{
  for(const config of [
    {workspace:'broken'},
    {workspace:{id:'other',ownerEmail:'owner@example.test'}},
    {member:'broken'},
    {member:[]}
  ]){
    const out=await run(config);assert.equal(out.status,503);assert.equal(out.mails,0);assert.equal(out.audits,0);
  }
});

test('admin sign-in link requires token readback before email delivery',async()=>{
  const out=await run({persist:false});
  assert.equal(out.status,503);assert.equal(out.mails,0);assert.equal(out.audits,0);
});
