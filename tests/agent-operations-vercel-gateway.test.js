'use strict';
// Real journal, grant admission, encrypted OAuth broker and deployment adapter.
// Only Vercel HTTP responses are substituted. No credentials or paid dispatch.
const {test}=require('node:test'),a=require('node:assert/strict'),oauth=require('../lib/agent-operations-vercel-oauth'),ops=require('../lib/agent-operations-operating-system');
const owner={kind:'owner',verifiedOwner:true,id:'owner@example.test',workspaceId:'workspace'},sha='a'.repeat(40),origin='https://my-ai-website-test-mohamtaj004bas-projects.vercel.app';
async function setup(options={}){
 const rows=new Map();let compareHook=null,ownerHook=null,statusHook=null,statusCalls=0,finalSnapshotRead=false;const kv={get:async k=>{if(statusCalls>=2&&k.includes(':operations:v1:'))finalSnapshotRead=true;return rows.get(k)||null;},eval:async(_,[key],[before,after])=>{if(compareHook&&key.includes(':operations:v1:')){const result=await compareHook(key,before,after);if(result!==undefined)return result;}if((rows.get(key)||'')!==before)return 0;rows.set(key,after);return 1;}},calls=[];
 let hook=null;
 const provider=async(url,options)=>{calls.push({url,method:options.method});if(hook)await hook(url);if(url.endsWith('/access_token'))return Response.json({access_token:'SECRET_TEST_TOKEN',team_id:oauth.TEAM});if(url.includes('/configuration/'))return Response.json({id:'icfg_test',integrationId:'oac_test',teamId:oauth.TEAM,projectSelection:'selected',projects:[oauth.PROJECT],slug:oauth.SLUG,scopes:['read:project','read-write:deployment','read:integration-configuration']});if(url.includes('/v9/projects/'))return Response.json({id:oauth.PROJECT,accountId:oauth.TEAM});a.equal(url,'https://api.vercel.com/v13/deployments/dpl_exact?teamId='+oauth.TEAM);return Response.json({id:'dpl_exact',projectId:oauth.PROJECT,url:new URL(origin).host,target:null,readyState:'READY',meta:{githubCommitSha:sha,githubCommitRef:'feature/callercore-dashboards'},env:{PRIVATE:'must-not-return'}});};
 const release=require('../lib/agent-operations-contracts').assertRelease(),connection=oauth.create({kv,env:{VERCEL_ENV:'preview',CALLERCORE_VERCEL_CLIENT_ID:'oac_test',CALLERCORE_VERCEL_CLIENT_SECRET:'SECRET_CLIENT_TEST',CALLERCORE_ENCRYPTION_KEY:'test-encryption-only-at-least-32-characters'},runtime:{branch:'feature/callercore-dashboards',sourceCommit:sha,origin,release},assertOwner:async x=>x.id===owner.id&&x.workspaceId===owner.workspaceId,fetchImpl:provider});
 const begin=await connection.begin(owner);await connection.callback(owner,{code:'test_code',state:new URL(begin.authorizationUrl).searchParams.get('state'),configurationId:'icfg_test',teamId:oauth.TEAM});calls.length=0;
 const guardedConnection={...connection,status:async actor=>{const result=await connection.status(actor);statusCalls++;if(statusHook)await statusHook(result,statusCalls);return result;}};
 const ledger={version:1,revision:0,tasks:[],reservations:[],operations:{workflows:[],grants:[],reservations:[],audit:[],approvals:[]}},service=ops.createOperations({kv,vercelConnection:guardedConnection,clock:options.clock||Date.now,runtime:{environment:'preview',branch:'feature/callercore-dashboards',origin,commit:sha,deploymentId:'dpl_exact'},assertOwner:async()=>ownerHook?ownerHook({finalSnapshotRead}):true,ledgerAdapter:{read:async()=>JSON.stringify(ledger)}});
 const plan=await service.create(owner,{idempotencyKey:'vercel_gateway_plan',objective:'Inspect this exact Preview deployment without writes.',priority:'normal',durationMs:600000,subtasks:[{key:'source',template:'engineering-inspect',dependsOn:[]}]}),grant=await service.connectionsManage(owner,{operation:'grant-read',expectedRevision:0,planId:plan.id,taskId:plan.tasks[0].id,tool:'vercel.deployment.read',resource:oauth.PROJECT+':dpl_exact',expiresAt:Date.now()+60000,maxCalls:1});
 const handler=require('../lib/agent-operations-api').createHandler({env:{VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'false',CALLERCORE_AGENTOPS_WORKER_SECRET:'w'.repeat(40)},store:require('../lib/agent-operations-store').createStore({read:async()=>JSON.stringify(ledger),compare:async()=>{throw Error('paid ledger mutation forbidden');}},{scope:{origin,commit:sha}}),operations:service,getSession:async()=>({email:owner.id,workspaceId:owner.workspaceId}),getMember:async()=>({email:owner.id,workspaceId:owner.workspaceId,role:'admin'}),getWorkspace:async()=>({ownerEmail:owner.id}),rateLimit:async()=>({limited:false})});
 async function call(input,extra={}){let status,body;await handler({method:'POST',body:{action:'operations-connections-inspect',input},query:{},headers:{host:new URL(origin).host,origin,...extra}},{setHeader(){},status(n){status=n;return this;},json(v){body=v;return this;}});return{status,body};}
 return{service,connection,plan,grant:grant.result,calls,provider,call,rows,hook:f=>{hook=f;},statusHook:f=>statusHook=f,ownerHook:f=>ownerHook=f,compareHook:f=>compareHook=f};
}
test('real Vercel gateway composition decrypts task-scoped credential, retrieves sanitized deployment and durably completes once',async()=>{
 const h=await setup(),original=global.fetch;global.fetch=h.provider;try{const receipt=await h.service.connectionsInspect(owner,{grantId:h.grant.id,idempotencyKey:'vercel_gateway_read'});a.equal(receipt.receipt.status,'completed');a.equal(receipt.receipt.evidence.deploymentId,'dpl_exact');a.equal(JSON.stringify(receipt).includes('SECRET'),false);a.equal(JSON.stringify(receipt).includes('PRIVATE'),false);a.deepEqual(h.calls.map(x=>x.method),['GET','GET']);const again=await h.service.connectionsInspect(owner,{grantId:h.grant.id,idempotencyKey:'vercel_gateway_read'});a.equal(again.replayed,true);a.equal(h.calls.length,2);const state=await h.service.read(owner);await h.service.connectionsManage(owner,{operation:'revoke-grant',expectedRevision:state.integrations.revision,grantId:h.grant.id});await h.service.cancel(owner,{planId:h.plan.id,expectedRevision:h.plan.revision});}finally{global.fetch=original;}
});
test('connection revocation during real broker configuration GET blocks deployment dispatch and revokes task grant',async()=>{
 const h=await setup(),original=global.fetch;global.fetch=h.provider;h.hook(async url=>{if(url.includes('/configuration/'))await h.connection.revoke(owner);});try{await a.rejects(h.service.connectionsInspect(owner,{grantId:h.grant.id,idempotencyKey:'vercel_gateway_revoke'}));a.equal(h.calls.filter(c=>c.url.includes('/v13/')).length,0);const state=await h.service.read(owner);a.equal(state.integrations.grants[0].revoked,true);a.equal(state.integrations.activity[0].status,'revoked');}finally{global.fetch=original;}
});
test('emergency stop revokes Vercel as well as GitHub authority without restoring connection credentials',async()=>{
 const h=await setup(),state=await h.service.read(owner);await h.service.emergencyStop(owner,{expectedRevision:state.revision});const stopped=await h.service.read(owner);a.ok(stopped.integrations.grants.every(g=>g.revoked));a.equal(stopped.integrations.providers.find(p=>p.id==='vercel').connection,'revoked');a.equal(stopped.plans[0].status,'cancelled');a.equal(h.calls.length,0);
});
test('Vercel grant and revocation audit receipts identify their actual provider',async()=>{
 const h=await setup(),before=await h.service.read(owner);a.equal(before.audit.filter(e=>e.type==='integration-policy-changed').at(-1).provider,'vercel');
 await h.service.connectionsManage(owner,{operation:'revoke-grant',expectedRevision:before.integrations.revision,grantId:h.grant.id});
 const after=await h.service.read(owner);a.equal(after.audit.filter(e=>e.type==='integration-policy-changed').at(-1).provider,'vercel');
});
test('guarded owner HTTP inspect traverses actual service/broker/adapter with replay and CSRF denials',async()=>{
 const h=await setup(),original=global.fetch;global.fetch=h.provider;try{
  const input={grantId:h.grant.id,idempotencyKey:'vercel_http_read'};a.equal((await h.call(input,{origin:'https://foreign.test'})).status,403);a.equal(h.calls.length,0);
  const result=await h.call(input);a.equal(result.status,200);a.equal(result.body.operatingSystem.receipt.status,'completed');a.equal(h.calls.length,2);
  a.equal((await h.call(input)).body.operatingSystem.replayed,true);a.equal(h.calls.length,2);a.equal((await h.call({...input,idempotencyKey:'extra_unapproved_read'})).status,409);a.equal(h.calls.length,2);
 }finally{global.fetch=original;}
});

const readInput=h=>({grantId:h.grant.id,idempotencyKey:'vercel_ordered_guard_read'});
const journal=h=>JSON.parse([...h.rows].find(([key])=>key.includes(':operations:v1:'))[1]);
async function revokeGrant(h){const state=await h.service.read(owner);await h.service.connectionsManage(owner,{operation:'revoke-grant',expectedRevision:state.integrations.revision,grantId:h.grant.id});}
function noCompletion(h){const s=journal(h);a.equal(s.integrations.invocations.some(i=>i.status==='completed'),false);a.equal(s.audit.some(e=>e.type==='integration-read-recorded'),false);return s;}

test('guarded HTTP initial status stall cannot hide grant revoke or task cancellation before provider access',async()=>{
 for(const mutation of ['revoke','cancel']){const h=await setup(),original=global.fetch;global.fetch=h.provider;let finish,entered;const waiting=new Promise(r=>entered=r);h.statusHook(async(_,number)=>{if(number===1){entered();await new Promise(r=>finish=r);}});
  try{const pending=h.call(readInput(h));await waiting;if(mutation==='revoke')await revokeGrant(h);else await h.service.cancel(owner,{planId:h.plan.id,expectedRevision:h.plan.revision});finish();a.equal((await pending).status,409);a.equal(h.calls.length,0);const s=noCompletion(h);a.equal(s.integrations.grants[0].revoked,true);a.equal(s.integrations.invocations[0].status,'revoked');}finally{global.fetch=original;}
 }
});

test('guarded HTTP final status stall cannot accept returned evidence after revoke or cancellation',async()=>{
 for(const mutation of ['revoke','cancel']){const h=await setup(),original=global.fetch;global.fetch=h.provider;let finish,entered;const waiting=new Promise(r=>entered=r);h.statusHook(async(_,number)=>{if(number===2){entered();await new Promise(r=>finish=r);}});
  try{const pending=h.call(readInput(h));await waiting;a.equal(h.calls.length,2);if(mutation==='revoke')await revokeGrant(h);else await h.service.cancel(owner,{planId:h.plan.id,expectedRevision:h.plan.revision});finish();a.equal((await pending).status,409);const s=noCompletion(h);a.equal(s.integrations.grants[0].revoked,true);a.equal(s.integrations.invocations[0].status,'revoked');a.equal(h.calls.length,2);}finally{global.fetch=original;}
 }
});

test('guarded HTTP retains fresh owner check after receipt snapshot and before CAS',async()=>{
 const h=await setup(),original=global.fetch;global.fetch=h.provider;let denied=0;h.ownerHook(({finalSnapshotRead})=>{if(finalSnapshotRead){denied++;return false;}return true;});
 try{a.equal((await h.call(readInput(h))).status,409);a.ok(denied>0);a.equal(h.calls.length,2);const s=noCompletion(h);a.equal(s.integrations.invocations[0].status,'pending','Denied owner cannot mutate cleanup journal either');h.ownerHook(null);await revokeGrant(h);a.equal(journal(h).integrations.invocations[0].status,'revoked');}finally{global.fetch=original;}
});

test('receipt CAS conflict rereads revoked grant or changed task fence and never retries stale completion',async()=>{
 for(const mutation of ['revoke','fence']){const h=await setup(),original=global.fetch;global.fetch=h.provider;let intercepted=0;
  h.compareHook(async(key,before,after)=>{if(JSON.parse(after).audit.at(-1)?.type!=='integration-read-recorded')return;intercepted++;h.compareHook(null);if(mutation==='revoke')await revokeGrant(h);else{const changed=JSON.parse(h.rows.get(key));changed.plans[0].tasks[0].fence++;changed.revision++;h.rows.set(key,JSON.stringify(changed));}return 0;});
  try{a.equal((await h.call(readInput(h))).status,409);a.equal(intercepted,1);a.equal(h.calls.length,2);const s=noCompletion(h);a.equal(s.integrations.invocations[0].status,'revoked');a.equal(s.integrations.grants[0].revoked,true);}finally{global.fetch=original;}
 }
});

test('final status latency cannot extend ten-second admission deadline',async()=>{
 let now=Date.now();const h=await setup({clock:()=>now}),original=global.fetch;global.fetch=h.provider;h.statusHook(async(_,number)=>{if(number===2)now+=10001;});
 try{a.equal((await h.call(readInput(h))).status,409);a.equal(h.calls.length,2);const s=noCompletion(h);a.equal(s.integrations.grants[0].revoked,true);a.equal(s.integrations.invocations[0].status,'revoked');a.equal(s.audit.find(e=>e.type==='integration-read-interrupted').failureCode,'INT_READ_UNCONFIRMED');}finally{global.fetch=original;}
});

test('concurrent guarded owner HTTP inspections admit one dispatch and preserve one completed receipt',async()=>{
 const h=await setup(),original=global.fetch;global.fetch=h.provider;
 try{const results=await Promise.all([h.call(readInput(h)),h.call(readInput(h))]);a.ok(results.every(r=>r.status===200));a.equal(h.calls.length,2);const s=journal(h);a.equal(s.integrations.invocations.length,1);a.equal(s.integrations.invocations[0].status,'completed');a.equal(s.audit.filter(e=>e.type==='integration-read-admitted').length,1);a.equal(s.audit.filter(e=>e.type==='integration-read-recorded').length,1);a.equal(results.filter(r=>r.body.operatingSystem.replayed).length,1);}finally{global.fetch=original;}
});
