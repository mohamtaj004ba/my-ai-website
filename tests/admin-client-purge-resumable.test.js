const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const purgeState=require('../lib/purge-state');
const {deidentifyProspectForAnalytics}=require('../lib/prospect-retention');

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
    'site:prospect:index':['prospect-1','prospect-2'],
    'site:prospect:prospect-1':{id:'prospect-1',workspaceId:'tenant',stripeCustomerId:'cus_1',stage:'converted',name:'Owner Person',business:'Client Co',email:'owner@example.com',phone:'5095550101',message:'Need help',visitorId:'visitor-private',sessionId:'session-private',industry:'Plumbing',category:'Home services',plan:'Growth',source:'google',utmSource:'google',utmMedium:'cpc',utmCampaign:'fall',firstSource:'google',firstUtmSource:'google',firstUtmMedium:'cpc',firstUtmCampaign:'fall',campaign:'Fall PPC',convertedAt:100,monthlyValue:399,setupValue:500,owner:'Sales Rep',notes:'private sales notes',nextFollowUpAt:200,lastContactAt:150,tags:['vip'],updatedBy:'admin@example.com',createdAt:10,updatedAt:20},
    'site:prospect:email:ownerhash':'prospect-1',
    'site:prospect:prospect-2':{id:'prospect-2',workspaceId:'other',email:'other@example.com',name:'Other Lead',stage:'qualified',createdAt:10,updatedAt:20},
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
    cleanEmail:x=>String(x||'').trim().toLowerCase(),emailKey:email=>email==='owner@example.com'?'ownerhash':'hash-'+email,deidentifyProspectForAnalytics,safeError:e=>String(e&&e.message||e),console:{error:()=>{}},
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

test('permanent purge completes through retained, shared, support, feedback, growth, conversation and content phases',async()=>{
  const f=fixture(),r=await f.purge();
  assert.equal(r.status,200);assert.equal(r.result.ok,true);assert.equal(r.result.supportDeleted,1);assert.equal(r.result.feedbackDeleted,1);assert.equal(r.result.prospectsDeidentified,1);
  assert.equal(f.records['workspace:tenant'],undefined);assert.deepEqual(f.records['workspace:index'],['other']);
  assert.equal(f.records['phone:index'][0].workspaceId,'');assert.equal(f.records['user:email:owner@example.com'],undefined);
  assert.equal(f.records['stripe:customer:cus_1'],undefined);assert.equal(f.records['stripe:subscription:sub_1'],undefined);
  assert.deepEqual(f.records['support:index'],['s2']);assert.equal(f.records['support:s1'],undefined);assert.ok(f.records['support:s2']);
  assert.deepEqual(f.records['ai-feedback:index'],['f2']);assert.equal(f.records['ai-feedback:f1'],undefined);assert.ok(f.records['ai-feedback:f2']);
  const prospect=f.records['site:prospect:prospect-1'];assert.equal(prospect.privacyState,'deidentified');assert.equal(prospect.stage,'converted');assert.equal(prospect.plan,'Growth');assert.equal(prospect.source,'google');assert.equal(prospect.monthlyValue,399);assert.equal(prospect.setupValue,500);
  for(const field of ['workspaceId','stripeCustomerId','name','business','email','phone','message','visitorId','sessionId','owner','notes','nextFollowUpAt','lastContactAt','tags','updatedBy'])assert.equal(Object.prototype.hasOwnProperty.call(prospect,field),false,field);
  assert.equal(f.records['site:prospect:email:ownerhash'],undefined);assert.equal(f.records['site:prospect:prospect-2'].name,'Other Lead');assert.equal(f.records['site:prospect:prospect-2'].workspaceId,'other');
  assert.equal(f.records['viewed:tenant:owner@example.com'],undefined);assert.equal(f.records['notify:tenant:owner@example.com'],undefined);assert.equal(f.records['profile:owner@example.com'],undefined);
  assert.ok(f.records['retention:workspace:tenant']);assert.equal(f.records['retention:support:tenant'].tickets[0].id,'s1');
  assert.equal(f.records['retention:audit:tenant'].events[0].action,'permanent_purge_completed');
  assert.ok(f.records['purge:complete:tenant']);assert.equal(f.records['purge:workspace:tenant'],undefined);
  assert.equal(f.conversationDeletes,1);
});

test('a storage failure pauses purge and a repeated confirmed request resumes from the journal',async()=>{
  const f=fixture({failConversationsOnce:true}),first=await f.purge();
  assert.equal(first.status,503);assert.equal(first.result.resumable,true);assert.equal(first.result.purgePhase,'growth');
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

test('Growth prospect email lookup conflicts pause before any linked prospect is de-identified',async()=>{
  const f=fixture();f.records['site:prospect:email:ownerhash']='prospect-2';
  const r=await f.purge();assert.equal(r.status,409);assert.equal(r.result.purgePhase,'feedback');assert.equal(r.result.resumable,true);
  const prospect=f.records['site:prospect:prospect-1'];assert.equal(prospect.name,'Owner Person');assert.equal(prospect.workspaceId,'tenant');assert.equal(prospect.privacyState,undefined);
  assert.equal(f.records['site:prospect:email:ownerhash'],'prospect-2');
});



test('unverifiable indexed support record pauses permanent purge before support deletion',async()=>{
  for(const bad of [null,'broken',{id:'wrong',workspaceId:'tenant'}]){
    const f=fixture();
    if(bad===null)delete f.records['support:s1'];else f.records['support:s1']=bad;
    const r=await f.purge();
    assert.equal(r.status,503);assert.equal(r.result.resumable,true);assert.equal(r.result.purgePhase,'detached');
    assert.match(r.result.error,/Support records could not be verified/);
    assert.deepEqual(f.records['support:index'],['s1','s2']);
    assert.equal(f.records['retention:support:tenant'],undefined);
  }
});

test('malformed phone inventory or owner mapping pauses purge before shared detachment',async()=>{
  const phone=fixture();phone.records['phone:index']=[{workspaceId:'tenant',number:'5095550100'}];
  let r=await phone.purge();assert.equal(r.status,503);assert.equal(r.result.purgePhase,'retained');assert.match(r.result.error,/Phone inventory contains unverifiable records/);
  assert.deepEqual(phone.records['workspace:index'],['tenant','other']);
  const owner=fixture();owner.records['user:email:owner@example.com']='broken';
  r=await owner.purge();assert.equal(r.status,503);assert.equal(r.result.purgePhase,'retained');assert.match(r.result.error,/Owner access mapping is malformed/);
  assert.deepEqual(owner.records['workspace:index'],['tenant','other']);
});

test('malformed onboarding retention state blocks purge before a durable journal starts',async()=>{
  for(const mutate of [
    f=>{f.records['onboarding:workspace-token:tenant']='   '},
    f=>{f.records['onboarding:workspace-token:tenant']={bad:true}},
    f=>{f.records['onboarding:workspace:tenant']={agreementVersion:'1',checklist:['bad']}}
  ]){
    const f=fixture();mutate(f);
    const r=await f.purge();
    assert.equal(r.status,503);
    assert.match(r.result.error,/Onboarding (token )?retention data is unavailable/);
    assert.equal(f.records['purge:workspace:tenant'],undefined);
    assert.equal(f.records['retention:workspace:tenant'],undefined);
  }
});

test('malformed retained support archive pauses before deleting another support batch',async()=>{
  for(const tickets of [
    [{workspaceId:'tenant'}],
    [{id:'dup',workspaceId:'tenant'},{id:'dup',workspaceId:'tenant'}],
    [{id:'foreign',workspaceId:'other'}]
  ]){
    const f=fixture();
    f.records['retention:support:tenant']={workspaceId:'tenant',tickets,retainedAt:1};
    const r=await f.purge();
    assert.equal(r.status,503);
    assert.equal(r.result.purgePhase,'detached');
    assert.match(r.result.error,/Retained support archive is malformed/);
    assert.ok(f.records['support:s1']);
    assert.deepEqual(f.records['support:index'],['s1','s2']);
  }
});

test('missing or malformed workspace feedback records pause before feedback deletion',async()=>{
  for(const mutate of [
    f=>{delete f.records['ai-feedback:f1']},
    f=>{f.records['ai-feedback:f1']='broken'},
    f=>{f.records['ai-feedback:f1']={id:'wrong',workspaceId:'tenant'}},
    f=>{f.records['ai-feedback:f1']={id:'f1',workspaceId:'other'}}
  ]){
    const f=fixture();mutate(f);
    const r=await f.purge();
    assert.ok([503,409].includes(r.status));
    assert.equal(r.result.purgePhase,'support');
    assert.ok(f.records['ai-feedback:workspace:tenant']?.includes('f1'));
    assert.ok(f.records['ai-feedback:index']?.includes('f1'));
  }
});

test('malformed audit rows pause before retention archive is written',async()=>{
  const f=fixture();
  f.records['audit:tenant']=[{id:'bad',workspaceId:'tenant',at:0}];
  const r=await f.purge();
  assert.equal(r.status,503);
  assert.equal(r.result.purgePhase,'conversations');
  assert.match(r.result.error,/audit history is malformed/);
  assert.equal(f.records['retention:audit:tenant'],undefined);
});

test('purge completion requires retention snapshot bound to the active attempt and a valid retained audit archive',()=>{
  assert.match(code,/String\(currentRetention\.purgeAttemptId\|\|''\)!==String\(journal\.attemptId\)/);
  assert.match(code,/Required retained audit archive is unavailable\. Permanent purge completion is paused/);
  assert.match(code,/retainedAudit\.events\.some\(event=>/);
  assert.match(code,/new Set\(retainedAudit\.events\.map\(event=>String\(event\.id\)\)\)\.size!==retainedAudit\.events\.length/);
});
