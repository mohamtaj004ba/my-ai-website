const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function runFunction(name,endName,{admin=false,indexValue=[],recordFailure=false,indexFailure=false}={}){
  const source=fs.readFileSync('api/account.js','utf8');
  const start=source.indexOf('async function '+name+'('),end=source.indexOf('\nasync function '+endName+'(',start);
  assert.ok(start>=0&&end>start);
  const kv={
    get:async key=>{
      if(key==='support:index'){
        if(indexFailure)throw Error('storage unavailable');
        return indexValue;
      }
      if(key.startsWith('support:')){
        if(recordFailure)throw Error('storage unavailable');
        return {id:key.slice('support:'.length),workspaceId:'ws_1',messages:[],messageCount:0,createdAt:1,updatedAt:1};
      }
      return null;
    }
  };
  const ctx=vm.createContext({
    requireSession:async()=>({workspaceId:'ws_1',email:'client@example.test'}),
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv,Set,Promise,Number,String,Array,Object,
    console:{error(){}},safeError:()=> 'redacted',
    req:{},res:{status(n){this.code=n;return this},json(x){this.body=x;return x}}
  });
  vm.runInContext(source.slice(start,end),ctx);
  return vm.runInContext(name+'(req,res)',ctx).then(()=>ctx.res);
}

test('client Support history returns a targeted 503 when storage reads fail',async()=>{
  const indexFailure=await runFunction('supportTickets','replySupportTicket',{indexFailure:true});
  assert.equal(indexFailure.code,503);
  assert.match(indexFailure.body.error,/temporarily unavailable/i);
  assert.match(indexFailure.body.error,/previously loaded requests should be preserved/i);

  const recordFailure=await runFunction('supportTickets','replySupportTicket',{indexValue:['ticket_1'],recordFailure:true});
  assert.equal(recordFailure.code,503);
  assert.match(recordFailure.body.error,/could not be verified/i);
  assert.match(recordFailure.body.error,/previously loaded requests should be preserved/i);
});

test('admin Support history returns a targeted 503 when storage reads fail',async()=>{
  const indexFailure=await runFunction('adminSupport','adminSupportReply',{admin:true,indexFailure:true});
  assert.equal(indexFailure.code,503);
  assert.match(indexFailure.body.error,/temporarily unavailable/i);
  assert.match(indexFailure.body.error,/previously loaded requests should be preserved/i);

  const recordFailure=await runFunction('adminSupport','adminSupportReply',{admin:true,indexValue:['ticket_1'],recordFailure:true});
  assert.equal(recordFailure.code,503);
  assert.match(recordFailure.body.error,/could not be verified/i);
  assert.match(recordFailure.body.error,/previously loaded requests should be preserved/i);
});


test('saved support ticket remains a confirmed success when notification settings cannot be read',async()=>{
  const source=fs.readFileSync('api/account.js','utf8');
  const start=source.indexOf('async function createSupportTicket(req,res)'),end=source.indexOf('\nasync function supportTickets(',start);
  assert.ok(start>=0&&end>start);
  let mails=0,commits=0;
  const ctx=vm.createContext({
    requireWritableSession:async()=>({workspaceId:'ws_1',email:'client@example.test'}),
    kv:{get:async key=>{
      if(key==='workspace:ws_1')return {id:'ws_1',name:'Test Workspace',ownerName:'Test Owner'};
      if(key==='support:index')return [];
      if(key==='platform:settings'||key==='settings:ws_1')throw Error('storage unavailable');
      return null;
    }},
    compareAndSetConfig:async()=>{commits++;return true},
    crypto:{randomUUID:(()=>{let i=0;return()=> 'id_'+(++i)})()},
    sendMail:async()=>{mails++},lifecycleEmail:()=>({}),escapeEmailHtml:x=>String(x),requestOrigin:()=> 'https://preview.example.test',
    process:{env:{}},Date,Number,String,Array,Object,Set,Promise,
    console:{error(){}},safeError:()=> 'redacted',
    req:{body:{subject:'Need help',message:'This is a sufficiently long support request.',priority:'normal'}},
    res:{status(n){this.code=n;return this},json(x){this.body=x;return x}}
  });
  vm.runInContext(source.slice(start,end),ctx);
  await vm.runInContext('createSupportTicket(req,res)',ctx);
  assert.equal(ctx.res.code,201);
  assert.equal(ctx.res.body.ok,true);
  assert.match(ctx.res.body.warning,/saved, but notification settings could not be verified/i);
  assert.equal(commits,1);
  assert.equal(mails,0);
});


function supportMutationContext(name,endName,{admin=false,statusUpdate=false}={}){
  const source=fs.readFileSync('api/account.js','utf8');
  const start=source.indexOf('async function '+name+'('),end=source.indexOf('\nasync function '+endName+'(',start);
  assert.ok(start>=0&&end>start);
  const ticket={id:'ticket_1',workspaceId:'ws_1',workspaceName:'Test Workspace',email:'client@example.test',subject:'Need help',status:'open',messages:[],messageCount:0,createdAt:1,updatedAt:2};
  const kv={get:async key=>{
    if(key==='support:ticket_1')return ticket;
    if(key==='platform:settings'||key==='settings:ws_1')throw Error('storage unavailable');
    return null;
  }};
  const ctx=vm.createContext({
    requireWritableSession:async()=>({workspaceId:'ws_1',email:'client@example.test'}),
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv,compareAndSetConfig:async()=>true,compareAndAudit:async()=>true,
    crypto:{randomUUID:()=> 'audit_1'},Date,Number,String,Array,Object,Promise,
    sendMail:async()=>{throw Error('mail should not send')},lifecycleEmail:()=>({}),escapeEmailHtml:x=>String(x),requestOrigin:()=> 'https://preview.example.test',
    console:{error(){}},safeError:()=> 'redacted',
    req:{body:statusUpdate?{id:'ticket_1',status:'resolved',expectedUpdatedAt:2}:{id:'ticket_1',message:'A valid reply message'}},
    res:{status(n){this.code=n;return this},json(x){this.body=x;return x}}
  });
  vm.runInContext(source.slice(start,end),ctx);
  return vm.runInContext(name+'(req,res)',ctx).then(()=>ctx.res);
}

test('confirmed client Support reply stays successful when notification settings cannot be read',async()=>{
  const res=await supportMutationContext('replySupportTicket','adminSupport');
  assert.equal(res.code,200);
  assert.equal(res.body.ok,true);
  assert.match(res.body.warning,/reply was saved/i);
});

test('confirmed admin Support reply stays successful when client notification settings cannot be read',async()=>{
  const res=await supportMutationContext('adminSupportReply','adminSupportUpdate',{admin:true});
  assert.equal(res.code,200);
  assert.equal(res.body.ok,true);
  assert.match(res.body.warning,/support reply was saved/i);
});

test('confirmed admin Support status stays successful when client notification settings cannot be read',async()=>{
  const res=await supportMutationContext('adminSupportUpdate','adminAiGuide',{admin:true,statusUpdate:true});
  assert.equal(res.code,200);
  assert.equal(res.body.ok,true);
  assert.match(res.body.warning,/support status was saved/i);
});
