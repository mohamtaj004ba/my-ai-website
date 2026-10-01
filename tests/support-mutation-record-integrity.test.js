const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');

function segment(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,start+' exists');
  return source.slice(a,b);
}
const clientReply=segment('async function replySupportTicket(','\nasync function adminSupport(');
const adminReply=segment('async function adminSupportReply(','\nasync function adminSupportUpdate(');
const adminUpdate=segment('async function adminSupportUpdate(','\nasync function adminAiGuide(');

async function invoke(code,name,{record,body,client=false}){
  let status=200,payload,writes=0,mails=0;
  const ctx=vm.createContext({
    requireWritableSession:async()=>({workspaceId:'client-1',email:'owner@example.test'}),
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv:{get:async key=>key==='support:ticket-1'?record:null},
    compareAndSetConfig:async()=>{writes++;return true},
    compareAndAudit:async()=>{writes++;return true},
    crypto:{randomUUID:()=> 'uuid'},Date:{now:()=>20},Math,Number,String,Array,Promise,
    sendMail:async()=>{mails++},safeError:()=>'',console:{error(){}},process:{env:{}},
    req:{body},res:{status(n){status=n;return this},json(x){payload=x;return x}}
  });
  vm.runInContext(code,ctx);
  await vm.runInContext(name+'(req,res)',ctx);
  return {status,payload,writes,mails};
}

test('client support reply rejects malformed or mismatched stored ticket identity before mutation',async()=>{
  for(const record of ['broken',[],{id:'other',workspaceId:'client-1',messages:[]}]){
    const r=await invoke(clientReply,'replySupportTicket',{record,body:{id:'ticket-1',message:'A valid reply'},client:true});
    assert.equal(r.status,503);assert.equal(r.writes,0);assert.equal(r.mails,0);
    assert.match(r.payload.error,/record is unavailable/);
  }
});

test('admin support reply rejects unverifiable stored ticket identity before audited mutation',async()=>{
  for(const record of ['broken',[],{id:'other',workspaceId:'client-1',messages:[]},{id:'ticket-1',messages:[]}]){
    const r=await invoke(adminReply,'adminSupportReply',{record,body:{id:'ticket-1',message:'A valid admin reply'}});
    assert.equal(r.status,503);assert.equal(r.writes,0);assert.equal(r.mails,0);
    assert.match(r.payload.error,/record is unavailable/);
  }
});

test('admin support status rejects unverifiable stored ticket identity before revision handling',async()=>{
  for(const record of ['broken',[],{id:'other',workspaceId:'client-1',updatedAt:10},{id:'ticket-1',updatedAt:10}]){
    const r=await invoke(adminUpdate,'adminSupportUpdate',{record,body:{id:'ticket-1',status:'resolved',expectedUpdatedAt:10}});
    assert.equal(r.status,503);assert.equal(r.writes,0);assert.equal(r.mails,0);
    assert.match(r.payload.error,/record is unavailable/);
  }
});
