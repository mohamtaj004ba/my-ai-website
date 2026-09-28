const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const purgeState=require('../lib/purge-state');

const source=fs.readFileSync('api/account.js','utf8');
const restoreBegin=source.indexOf('async function adminRestoreDeletedClient(');
const restoreEnd=source.indexOf('\nasync function setRetentionRecord(',restoreBegin);
const begin=source.indexOf('async function setRetentionRecord(');
const finish=source.indexOf('\nasync function adminTechSupport(',begin);
assert.ok(restoreBegin>=0&&restoreEnd>restoreBegin&&begin>=0&&finish>begin);
const code=source.slice(restoreBegin,restoreEnd)+'\n'+source.slice(begin,finish);

function same(a,b){return JSON.stringify(a??null)===JSON.stringify(b??null)}
function fixture({failConversationsOnce=false,foreignStripe=false}={}){
  let n=0,status=200,result,conversationDeletes=0,failConversation=failConversationsOnce;
  const now=Date.now();
  const records={
    'workspace:tenant':{id:'tenant',name:'Client Co',ownerEmail:'owner@example.com',status:'pending_deletion',subscriptionStatus:'canceled',stripeCustomerId:'cus_1',stripeSubscriptionId:'sub_1',deletionRequestedAt:1,purgeEligibleAt:2,preDeletionStatus:'active',createdAt:5,updatedAt:10},
    'onboarding:workspace:tenant':{agreementVersion:'1',agreementSignedAt:3,agreementSignedName:'Owner'},
    'onboarding:workspace-token:tenant':'token-1','onboarding:token-1':{email:'owner@example.com'},
    'workspace:index':['tenant','other'],
    'phone:index':[{id:'p1',workspaceId:'tenant',workspaceName:'Client Co',number:'5095550100'}],
    'user:email:owner@example.com':{workspaceId:'tenant',role:'owner',email:'owner@example.com',disabled:true,sessionVersion:2},
    'stripe:customer:cus_1':foreignStripe?'other':'tenant','stripe:subscription:sub_1':'tenant',
    'support:index':['s1','s2'],'support:s1':{id:'s1',workspaceId:'tenant',subject:'Help'},'support:s2':{id:'s2',workspaceId:'other',subject:'Other'},
    'ai-feedback:workspace:tenant':['f1'],'ai-feedback:index':['f1','f2'],'ai-feedback:f1':{id:'f1',workspaceId:'tenant',message:'private'},'ai-feedback:f2':{id:'f2',workspaceId:'other'},
    'audit:tenant':[],
    'agent:tenant':{name:'Maya'},'calls:tenant':[{id:'c1'}],'calls:index:tenant':[{id:'c1'}],'leads:tenant':[{id:'l1'}],
    'conversations:tenant':[{id:'conv1'}],'appointments:tenant':[],'automations:tenant':[],'settings:tenant':{},'integrations:tenant':{},
    'locations:tenant':[],'routing-request:tenant':{},'followup:state:tenant':{},'provisioning:override:tenant':{},'provisioning:history:tenant':[],
    'viewed:tenant:owner@example.com':['c1'],'notify:tenant:owner@example.com':['n1'],'profile:owner@example.com':{displayName:'Owner'}
  };
  const operations=[];
  const kv={
    async get(key){return records[key]},
    async set(key,value,opts){records[key]=value;operations.push({type:'set',key,opts});return 'OK'},
    async del(key){delete records[key];operations.push({type:'del',key});return 1}
  };
  function apply(updates,deleteKeys=[]){
    for(const u of updates)if(!same(records[u.key],u.before))return false;
    for(const u of updates){if(deleteKeys.includes(u.key))delete records[u.key];else records[u.key]=u.after}
    return true;
  }
  const ctx=vm.createContext({
    requireAdmin:async()=>({email:'admin@callercore.com',workspaceId:'admin'}),
    kv,crypto:{randomUUID:()=> 'uuid-'+(++n)},Date,Promise,String,Number,Math,Set,Map,Array,Object,JSON,
    cleanEmail:x=>String(x||'').trim().toLowerCase(),safeError:e=>String(e&&e.message||e),console:{error:()=>{}},
    compareAndSetConfig:async(_,updates)=>apply(updates),
    compareAndSetWithDelete:async(_,updates,{deleteKeys=[]}={})=>apply(updates,deleteKeys),
    compareAndAudit:async(_,update,auditKey,event)=>{
      if(!apply([update]))return false;
      const list=Array.isArray(records[auditKey])?records[auditKey]:[];records[auditKey]=[event,...list].slice(0,200);return true;
    },
    compareAndAuditBatch:async(_,updates,auditKey,event,{deleteKeys=[]}={})=>{
      if(!apply(updates,deleteKeys))return false;
      const list=Array.isArray(records[auditKey])?records[auditKey]:[];records[auditKey]=[event,...list].slice(0,200);return true;
    },
    deleteNormalizedConversations:async()=>{
      conversationDeletes++;
      if(failConversation){failConversation=false;throw Error('simulated normalized store failure')}
      delete records['conv-v2:index:tenant'];
    },
    aiFeedbackWorkspaceIndexKey:id=>'ai-feedback:workspace:'+id,
    callViewedKey:(id,email)=>'viewed:'+id+':'+email,
    notificationReadKey:(_scope,email,id)=>'notify:'+id+':'+email,
    userProfileKey:email=>'profile:'+email,
    ...purgeState,
    req:{body:{id:'tenant',confirm:'DELETE tenant',expectedUpdatedAt:10}},
    res:{status(v){status=v;return this},json(v){result=v;return v}}
  });
  vm.runInContext(code,ctx);
  return {
    records,operations,ctx,get status(){return status},get result(){return result},get conversationDeletes(){return conversationDeletes},
    async purge(){status=200;result=undefined;await vm.runInContext('adminPurgeClient(req,res)',ctx);return {status,result}},
    async restore(){status=200;result=undefined;await vm.runInContext('adminRestoreDeletedClient(req,res)',ctx);return {status,result}}
  };
}

test('permanent purge completes through retained, shared, support, feedback, conversation and content phases',async()=>{
  const f=fixture(),r=await f.purge();
  assert.equal(r.status,200);assert.equal(r.result.ok,true);assert.equal(r.result.supportDeleted,1);assert.equal(r.result.feedbackDeleted,1);
  assert.equal(f.records['workspace:tenant'],undefined);assert.deepEqual(f.records['workspace:index'],['other']);
  assert.equal(f.records['phone:index'][0].workspaceId,'');assert.equal(f.records['user:email:owner@example.com'],undefined);
  assert.equal(f.records['stripe:customer:cus_1'],undefined);assert.equal(f.records['stripe:subscription:sub_1'],undefined);
  assert.deepEqual(f.records['support:index'],['s2']);assert.equal(f.records['support:s1'],undefined);assert.ok(f.records['support:s2']);
  assert.deepEqual(f.records['ai-feedback:index'],['f2']);assert.equal(f.records['ai-feedback:f1'],undefined);assert.ok(f.records['ai-feedback:f2']);
  assert.equal(f.records['viewed:tenant:owner@example.com'],undefined);assert.equal(f.records['notify:tenant:owner@example.com'],undefined);assert.equal(f.records['profile:owner@example.com'],undefined);
  assert.ok(f.records['retention:workspace:tenant']);assert.equal(f.records['retention:support:tenant'].tickets[0].id,'s1');
  assert.equal(f.records['retention:audit:tenant'].events[0].action,'permanent_purge_completed');
  assert.ok(f.records['purge:complete:tenant']);assert.equal(f.records['purge:workspace:tenant'],undefined);
  assert.equal(f.conversationDeletes,1);
});

test('a storage failure pauses purge and a repeated confirmed request resumes from the journal',async()=>{
  const f=fixture({failConversationsOnce:true}),first=await f.purge();
  assert.equal(first.status,503);assert.equal(first.result.resumable,true);assert.equal(first.result.purgePhase,'feedback');
  assert.equal(f.records['workspace:tenant']?.status,'pending_deletion');assert.ok(f.records['purge:workspace:tenant']);
  const attempt=f.records['purge:workspace:tenant'].attemptId;
  const second=await f.purge();assert.equal(second.status,200);assert.equal(f.records['purge:complete:tenant'].attemptId,attempt);
  assert.equal(f.conversationDeletes,2);
});

test('restore is blocked as soon as the durable purge journal exists',async()=>{
  const f=fixture({failConversationsOnce:true});await f.purge();
  f.ctx.req.body={id:'tenant',expectedUpdatedAt:Number(f.records['workspace:tenant'].updatedAt)};
  const r=await f.restore();assert.equal(r.status,409);assert.match(r.result.error,/Permanent purge has already started/);
});

test('foreign Stripe mapping pauses before shared identity data is detached',async()=>{
  const f=fixture({foreignStripe:true}),r=await f.purge();
  assert.equal(r.status,409);assert.equal(r.result.purgePhase,'retained');assert.equal(r.result.resumable,true);
  assert.equal(f.records['user:email:owner@example.com'].workspaceId,'tenant');
  assert.deepEqual(f.records['workspace:index'],['tenant','other']);
  assert.equal(f.records['purge:workspace:tenant'].phase,'retained');
});

test('initial purge requires the displayed pending-deletion workspace revision',async()=>{
  const f=fixture();f.ctx.req.body.expectedUpdatedAt=9;
  const r=await f.purge();assert.equal(r.status,409);assert.match(r.result.error,/changed since you opened it/);
  assert.equal(f.records['purge:workspace:tenant'],undefined);assert.equal(f.records['retention:workspace:tenant'],undefined);
});
