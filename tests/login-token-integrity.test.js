const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync('api/account.js','utf8');

function segment(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,start+' exists');
  return source.slice(a,b);
}
const helpers=segment('function loginTokenKey(','\nasync function logout(');
const loginCode=segment('async function requestLogin(','\nasync function verify(');
const verifyCode=segment('async function verify(','\nasync function logout(');

function memory(values={}){
  const store=new Map(Object.entries(values));let mails=0,sessions=0,lastSession=null,status=200,payload=null,redirect=null;
  const ctx=vm.createContext({
    crypto,kv:{
      async incr(){return 1},async expire(){return 1},
      async get(k){return store.has(k)?store.get(k):null},
      async set(k,v){store.set(k,v);return 'OK'},
      async del(k){store.delete(k);return 1}
    },
    cleanEmail:v=>String(v||'').trim().toLowerCase(),WINDOW:60,MAX:10,
    requestOrigin:()=> 'https://preview.example.test',authEmail:()=>({}),sendMail:async()=>{mails++},
    safeError:()=>'',console:{error(){}},process:{env:{}},
    createSession:async(_res,v)=>{sessions++;lastSession=v},
    Promise,Array,Object,String,Number,Error,encodeURIComponent,
    req:{headers:{'x-forwarded-for':'127.0.0.1'},body:{email:'owner@example.test',next:'/dashboard'},query:{}},
    res:{status(n){status=n;return this},json(v){payload=v;return v},redirect(n,u){status=n;redirect=u;return u}}
  });
  vm.runInContext(helpers+'\n'+loginCode+'\n'+verifyCode,ctx);
  return {ctx,store,get mails(){return mails},get sessions(){return sessions},get lastSession(){return lastSession},read:()=>({status,payload,redirect})};
}

test('magic-link request silently refuses malformed membership or workspace identity',async()=>{
  for(const values of [
    {'user:email:owner@example.test':'broken'},
    {'user:email:owner@example.test':{workspaceId:'ws-1',sessionVersion:0},'workspace:ws-1':'broken'},
    {'user:email:owner@example.test':{workspaceId:'ws-1',sessionVersion:0},'workspace:ws-1':{id:'other'}}
  ]){
    const f=memory(values);await vm.runInContext('requestLogin(req,res)',f.ctx);
    assert.equal(f.read().status,200);assert.equal(f.mails,0);
    assert.equal(Array.from(f.store.keys()).some(k=>String(k).startsWith('login:v2:')),false);
  }
});

test('magic-link request confirms token storage before sending provider email',async()=>{
  const f=memory({'user:email:owner@example.test':{workspaceId:'ws-1',role:'owner',sessionVersion:3},'workspace:ws-1':{id:'ws-1',status:'active'}});
  const originalSet=f.ctx.kv.set;
  f.ctx.kv.set=async(k,v)=>{if(String(k).startsWith('login:v2:'))return 'OK';return originalSet(k,v)};
  await vm.runInContext('requestLogin(req,res)',f.ctx);
  assert.equal(f.read().status,503);assert.equal(f.mails,0);
});

test('stale magic link cannot bypass a later session-version revocation',async()=>{
  const token='a'.repeat(64),key='login:v2:'+crypto.createHash('sha256').update(token).digest('hex');
  const f=memory({
    [key]:{email:'owner@example.test',workspaceId:'ws-1',role:'owner',next:'/dashboard',authVersion:4},
    'user:email:owner@example.test':{workspaceId:'ws-1',role:'owner',sessionVersion:5},
    'workspace:ws-1':{id:'ws-1',status:'active'}
  });
  f.ctx.req.query={token};
  await vm.runInContext('verify(req,res)',f.ctx);
  assert.equal(f.read().redirect,'/login?error=expired');assert.equal(f.sessions,0);assert.equal(f.store.has(key),false);
});

test('matching verified magic link creates session for the same workspace revision',async()=>{
  const token='b'.repeat(64),key='login:v2:'+crypto.createHash('sha256').update(token).digest('hex');
  const f=memory({
    [key]:{email:'owner@example.test',workspaceId:'ws-1',role:'owner',next:'/dashboard',authVersion:5},
    'user:email:owner@example.test':{workspaceId:'ws-1',role:'owner',sessionVersion:5},
    'workspace:ws-1':{id:'ws-1',status:'active'}
  });
  f.ctx.req.query={token};
  await vm.runInContext('verify(req,res)',f.ctx);
  assert.equal(f.read().redirect,'/dashboard');assert.equal(f.sessions,1);
  assert.equal(f.lastSession.workspaceId,'ws-1');assert.equal(f.lastSession.authVersion,5);
});
