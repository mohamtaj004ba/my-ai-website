'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),o=require('../lib/agent-operations-vercel-oauth');
const actor={id:'owner',workspaceId:'workspace'},env={VERCEL_ENV:'preview',CALLERCORE_VERCEL_CLIENT_ID:'oac_test',CALLERCORE_VERCEL_CLIENT_SECRET:'CLIENT_SECRET_TEST',CALLERCORE_ENCRYPTION_KEY:'test-encryption-key-only-at-least-32-characters'},runtime={branch:'feature/callercore-dashboards',sourceCommit:'a'.repeat(40),release:{digest:'b'.repeat(64)},origin:'https://my-ai-website-test-mohamtaj004bas-projects.vercel.app'};
function store(){const map=new Map();return{map,async get(k){return structuredClone(map.get(k)||null);},async eval(_,keys,args){const current=map.get(keys[0])||null;if((current?JSON.stringify(current):'')!==args[0])return 0;map.set(keys[0],JSON.parse(args[1]));const audit=map.get(keys[1])||[];map.set(keys[1],[JSON.parse(args[2]),...audit]);return 1;}};}
const facts=()=>({id:'icfg_test',integrationId:'oac_test',teamId:o.TEAM,projectSelection:'selected',projects:[o.PROJECT],slug:o.SLUG,scopes:[]});
function harness(extra={}){const kv=store(),calls=[];let api;api=o.create({kv,env,runtime,assertOwner:async x=>x.id==='owner'&&x.workspaceId==='workspace',fetchImpl:async(url,options)=>{calls.push([url,options]);return Response.json(url.endsWith('/access_token')?{access_token:'SECRET_TOKEN_TEST',team_id:o.TEAM,installation_id:'icfg_test'}:url.includes('/v9/projects/')?{id:o.PROJECT,accountId:o.TEAM,env:{SECRET:'NOT_RETURNED'}}:facts());},...extra});return{api,kv,calls};}
async function query(h){const begun=await h.api.begin(actor);return{code:'CODE_TEST',state:new URL(begun.authorizationUrl).searchParams.get('state'),configurationId:'icfg_test',teamId:o.TEAM};}
test('unconfigured status is honest and begin cannot fabricate connection flow',async()=>{const h=harness({env:{...env,CALLERCORE_VERCEL_CLIENT_ID:''}});a.equal((await h.api.status(actor)).configured,false);await a.rejects(h.api.begin(actor),/VCO_CONFIGURATION_REQUIRED/);a.equal(h.calls.length,0);});
test('owner-only Preview policy blocks cross tenant and production before writes or calls',async()=>{for(const bad of [{...actor,id:'other'},{...actor,workspaceId:'foreign'}])await a.rejects(harness().api.begin(bad),/VCO_OWNER_REQUIRED/);await a.rejects(harness({env:{...env,VERCEL_ENV:'production'}}).api.begin(actor),/VCO_PREVIEW_REQUIRED/);});
test('legitimate state/code flow consumes once, fixed transport,encrypted AAD storage and safe metadata',async()=>{const h=harness(),q=await query(h),r=await h.api.callback(actor,q);a.equal(r.status,'identity-verified-scope-unconfirmed');a.equal(r.operationalRead,false);a.equal(h.calls.length,3);a.equal(h.calls[0][0],'https://api.vercel.com/v2/oauth/access_token');a.equal(h.calls[0][1].method,'POST');a.equal(new URLSearchParams(h.calls[0][1].body).get('redirect_uri'),o.REDIRECT);a.equal(h.calls[1][0],'https://api.vercel.com/v1/integrations/configuration/icfg_test?teamId='+o.TEAM);a.equal(h.calls[1][1].method,'GET');a.equal(JSON.stringify([...h.kv.map.values()]).includes('SECRET_TOKEN_TEST'),false);a.equal(JSON.stringify(r).includes('SECRET'),false);await a.rejects(h.api.callback(actor,q),/VCO_STATE_DENIED/);await a.rejects(h.api.credentialBroker(actor),/VCO_READ_UNCONFIRMED/);a.equal(h.calls.length,3);});
test('CSRF wrong state,team and stale release fail before token transport',async()=>{const h=harness(),q=await query(h);await a.rejects(h.api.callback(actor,{...q,state:'x'.repeat(43)}),/VCO_STATE_DENIED/);await a.rejects(h.api.callback(actor,{...q,teamId:'other'}),/VCO_CALLBACK_INVALID/);const other=o.create({kv:h.kv,env,runtime:{...runtime,sourceCommit:'c'.repeat(40)},assertOwner:async()=>true,fetchImpl:async()=>{throw Error('not expected');}});await a.rejects(other.callback(actor,q),/VCO_STATE_DENIED/);a.equal(h.calls.length,0);});
test('expired state and refreshed begin deny old callback',async()=>{let now=1000;const h=harness({clock:()=>now}),q=await query(h);now+=600001;await a.rejects(h.api.callback(actor,q),/VCO_STATE_DENIED/);const fresh=await query(h);await h.api.begin(actor);await a.rejects(h.api.callback(actor,fresh),/VCO_STATE_DENIED/);a.equal(h.calls.length,0);});
test('configuration account/project/integration substitution and disabled states reject',async()=>{for(const change of [{teamId:'other'},{integrationId:'oac_foreign'},{projectSelection:'all'},{projects:[o.PROJECT,'foreign']},{disabledAt:1},{deletedAt:1},{status:'error'},{scopes:[{type:'unknown'}]}]){let n=0;const h=harness({fetchImpl:async()=>Response.json(++n===1?{access_token:'SECRET_TOKEN_TEST',team_id:o.TEAM}:{...facts(),...change})}),q=await query(h);await a.rejects(h.api.callback(actor,q),/VCO_EXCHANGE_UNCONFIRMED/);a.equal((await h.api.status(actor)).connected,false);await a.rejects(h.api.callback(actor,q),/VCO_STATE_DENIED/);a.equal(n,2);}});
test('central local revocation during exchange prevents storing or resurrecting credential',async()=>{let api,n=0;const h=harness({fetchImpl:async()=>{n++;if(n===1){await api.revoke(actor);return Response.json({access_token:'SECRET_TOKEN_TEST',team_id:o.TEAM});}return Response.json(facts());}});api=h.api;const q=await query(h);await a.rejects(api.callback(actor,q),/VCO_EXCHANGE_UNCONFIRMED/);const status=await api.status(actor);a.equal(status.status,'revoked');a.equal(status.connected,false);a.equal(JSON.stringify([...h.kv.map.values()]).includes('ciphertext'),false);});
test('concurrent callbacks atomically consume state once',async()=>{const h=harness(),q=await query(h),r=await Promise.allSettled([h.api.callback(actor,q),h.api.callback(actor,q)]);a.equal(r.filter(x=>x.status==='fulfilled').length,1);a.equal(h.calls.filter(x=>x[1].method==='POST').length,1);});
test('Redis outage fails closed before exchange and broker/provider secrets stay sanitized',async()=>{const h=harness(),q=await query(h);h.kv.eval=async()=>{throw Error('redis down');};await a.rejects(h.api.callback(actor,q));a.equal(h.calls.length,0);const failed=harness({fetchImpl:async()=>{throw Error('SECRET_TOKEN_TEST');}}),z=await query(failed);await a.rejects(failed.api.callback(actor,z),/^Error: VCO_EXCHANGE_UNCONFIRMED$/);});
test('abort during stalled token response never stores credential or issues configuration GET',async()=>{let finish,n=0;const h=harness({fetchImpl:()=>{n++;return new Promise(resolve=>{finish=resolve;});}}),q=await query(h),c=new AbortController(),pending=h.api.callback(actor,q,{signal:c.signal});await new Promise(setImmediate);c.abort();await a.rejects(pending,/VCO_EXCHANGE_UNCONFIRMED/);finish(Response.json({access_token:'SECRET_TOKEN_TEST',team_id:o.TEAM}));await new Promise(setImmediate);a.equal(n,1);a.equal((await h.api.status(actor)).connected,false);});
test('project GET rejects substituted account or project and never stores a token',async()=>{for(const project of [{id:o.PROJECT,accountId:'other'},{id:'prj_other',accountId:o.TEAM}]){let n=0;const h=harness({fetchImpl:async()=>Response.json(++n===1?{access_token:'SECRET_TOKEN_TEST',team_id:o.TEAM}:n===2?facts():project)}),q=await query(h);await a.rejects(h.api.callback(actor,q),/VCO_EXCHANGE_UNCONFIRMED/);a.equal(n,3);a.equal((await h.api.status(actor)).connected,false);a.equal(JSON.stringify([...h.kv.map.values()]).includes('ciphertext'),false);}});
test('revoked record after configuration response prevents project read',async()=>{let n=0,api;const h=harness({fetchImpl:async()=>{n++;if(n===1)return Response.json({access_token:'SECRET_TOKEN_TEST',team_id:o.TEAM});await api.revoke(actor);return Response.json(facts());}});api=h.api;const q=await query(h);await a.rejects(api.callback(actor,q),/VCO_EXCHANGE_UNCONFIRMED/);a.equal(n,2);a.equal((await api.status(actor)).status,'revoked');});
test('encrypted token authenticates exact owner workspace provider environment and configuration',async()=>{const crypto=require('node:crypto'),h=harness(),q=await query(h);await h.api.callback(actor,q);const record=[...h.kv.map.values()].find(x=>x.version===o.VERSION),raw=Buffer.from(record.connection.ciphertext,'base64url'),key=crypto.createHash('sha256').update(env.CALLERCORE_ENCRYPTION_KEY).digest(),aad={version:o.VERSION,ownerHash:record.ownerHash,workspaceHash:record.workspaceHash,provider:'vercel',environment:'preview',configurationId:'icfg_test'};function decrypt(binding){const decipher=crypto.createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));decipher.setAAD(Buffer.from(JSON.stringify(binding)));decipher.setAuthTag(raw.subarray(12,28));return Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString('utf8');}a.equal(decrypt(aad),'SECRET_TOKEN_TEST');for(const field of ['ownerHash','workspaceHash','provider','environment','configurationId'])a.throws(()=>decrypt({...aad,[field]:'other'}));const status=await h.api.status(actor);a.equal(status.projectReceipt.projectId,o.PROJECT);a.equal(status.projectReceipt.sourceCommit,runtime.sourceCommit);a.equal(JSON.stringify(status).includes('NOT_RETURNED'),false);});
test('failed callback preserves finite phase HTTP class and elapsed timing without payload',async()=>{for(const [phase,at]of [['token-exchange',1],['configuration-read',2],['project-read',3]])for(const [http,category]of [[401,'provider-401'],[403,'provider-403'],[429,'provider-429'],[503,'provider-5xx'],[418,'provider-other-http']]){let n=0,now=10000;const h=harness({clock:()=>now,fetchImpl:async()=>{n++;now+=5;return n===at?new Response('SECRET_PROVIDER_PAYLOAD',{status:http}):Response.json(n===1?{access_token:'SECRET_TOKEN_TEST',team_id:o.TEAM}:facts());}}),q=await query(h);await a.rejects(h.api.callback(actor,q),/VCO_EXCHANGE_UNCONFIRMED/);const r=await h.api.status(actor);a.equal(r.pendingState,'failed');a.equal(r.lastFailure.phase,phase);a.equal(r.lastFailure.category,category);a.equal(r.lastFailure.elapsedMs,at*5);a.equal(JSON.stringify(r).includes('SECRET'),false);a.equal(JSON.stringify(r).includes(q.state),false);a.equal(JSON.stringify(r).includes('CODE_TEST'),false);}});
test('unknown exception properties never enter diagnostic status or audit',async()=>{const h=harness({fetchImpl:async()=>{const e=Error('SECRET_MESSAGE');e.code='SECRET_CODE';e.response={token:'SECRET_TOKEN'};throw e;}}),q=await query(h);await a.rejects(h.api.callback(actor,q),/VCO_EXCHANGE_UNCONFIRMED/);const r=await h.api.status(actor);a.deepEqual(Object.keys(r.lastFailure).sort(),['category','elapsedMs','phase']);a.equal(r.lastFailure.category,'transport-unconfirmed');a.equal(JSON.stringify([...h.kv.map.values()]).includes('SECRET_'),false);});
test('corrupt stored connection metadata receipts and diagnostic fields fail closed',async()=>{for(const corrupt of [r=>r.status='connected',r=>r.connection.projectReceipt.projectId='prj_foreign',r=>r.connection.projectReceipt.evidenceHash='f'.repeat(64),r=>r.connection.scopes=[{token:'PRIVATE'}],r=>r.connection.token='PRIVATE',r=>r.lastFailure={phase:'project-read',category:'PRIVATE',elapsedMs:0}]){const h=harness(),q=await query(h);await h.api.callback(actor,q);const [key,record]=[...h.kv.map.entries()].find(([,v])=>v.version===o.VERSION);corrupt(record);h.kv.map.set(key,record);await a.rejects(h.api.status(actor),/VCO_STORE_INVALID/);}const h=harness();await h.api.revoke(actor);a.equal((await h.api.begin(actor)).status,'owner-consent-required');});


test('inherited exception names remain finite transport diagnostics',async()=>{for(const message of ['__proto__','constructor','toString']){const h=harness({fetchImpl:async()=>{throw Error(message);}}),q=await query(h);await a.rejects(h.api.callback(actor,q),/VCO_EXCHANGE_UNCONFIRMED/);a.equal((await h.api.status(actor)).lastFailure.category,'transport-unconfirmed');}});

test('private integration uses observed team Dashboard entry with only fresh single-use state',async()=>{const h=harness(),b=await h.api.begin(actor),url=new URL(b.authorizationUrl);a.equal(url.origin,'https://vercel.com');a.equal(url.pathname,'/mohamtaj004bas-projects/~/integrations/callercore-agent-operations');a.deepEqual([...url.searchParams.keys()],['state']);a.match(url.searchParams.get('state'),/^[A-Za-z0-9_-]{43}$/);a.equal(h.calls.length,0);});
test('private flow never synthesizes missing altered or revoked state before provider transport',async()=>{for(const mutation of [q=>{delete q.state;},q=>q.state='x'.repeat(43),async(q,h)=>{await h.api.revoke(actor);}]){const h=harness(),q=await query(h);await mutation(q,h);await a.rejects(h.api.callback(actor,q));a.equal(h.calls.length,0);}});

const approvedScopes=['read:project','read-write:deployment','read:integration-configuration'];
async function connectedBrokerHarness(){
 let readHook=null;const calls=[],h=harness({fetchImpl:async(url,options)=>{calls.push({url,method:options.method});if(readHook)return readHook(url,options);return Response.json(url.endsWith('/access_token')?{access_token:'SECRET_TOKEN_TEST',team_id:o.TEAM}:url.includes('/v9/projects/')?{id:o.PROJECT,accountId:o.TEAM}:{...facts(),scopes:approvedScopes});}});
 await h.api.callback(actor,await query(h));calls.length=0;
 return{...h,calls,hook:f=>{readHook=f;},request:{connectionId:'icfg_test',projectId:o.PROJECT,teamId:o.TEAM},options:()=>({signal:new AbortController().signal,authorize:async()=>true,deadline:Date.now()+5000,binding:{deploymentId:'dpl_test',sourceCommit:runtime.sourceCommit}})};
}
test('trusted Vercel read broker revalidates current fixed configuration and returns internal lease, not provider expiry',async()=>{
 const h=await connectedBrokerHarness(),lease=await h.api.credentialBroker(actor,h.request,h.options());
 a.equal(lease.token,'SECRET_TOKEN_TEST');a.equal(lease.providerExpiresAt,null);a.ok(lease.internalLeaseExpiresAt>Date.now());a.equal(lease.connectionRevision,3);a.equal(await lease.revalidate(),true);
 a.deepEqual(h.calls,[{url:'https://api.vercel.com/v1/integrations/configuration/icfg_test?teamId='+o.TEAM,method:'GET'}]);
 a.equal((await h.api.status(actor)).operationalRead,false);a.equal(JSON.stringify(await h.api.status(actor)).includes('SECRET'),false);
 await h.api.revoke(actor);await a.rejects(lease.revalidate());
});
test('broker requires exact resource, trusted task authority and bounded internal deadline before provider access',async()=>{
 const h=await connectedBrokerHarness();for(const [request,options]of [[{...h.request,teamId:'foreign'},h.options()],[{...h.request,extra:true},h.options()],[h.request,{...h.options(),authorize:async()=>false}],[h.request,{...h.options(),deadline:Date.now()+20000}],[h.request,{}]])await a.rejects(h.api.credentialBroker(actor,request,options),/^Error: VCO_READ_UNCONFIRMED$/);
 a.equal(h.calls.length,0);
});
test('broker rejects stored or fresh duplicate, missing and additional scopes without issuing a lease',async()=>{
 for(const scopes of [[],[...approvedScopes,'read:user'],[approvedScopes[0],approvedScopes[0],approvedScopes[2]]])for(const stored of [true,false]){
  const h=await connectedBrokerHarness();if(stored){const [key,record]=[...h.kv.map].find(([,v])=>v.version===o.VERSION);record.connection.scopes=scopes;h.kv.map.set(key,record);}else h.hook(async()=>Response.json({...facts(),scopes}));
  await a.rejects(h.api.credentialBroker(actor,h.request,h.options()),/VCO_READ_UNCONFIRMED/);a.equal(h.calls.length,stored?0:1);
 }
});
test('revocation or replacement while configuration transport is in flight cannot return old authority',async()=>{
 for(const change of ['revoke','begin']){const h=await connectedBrokerHarness();h.hook(async()=>{await h.api[change](actor);return Response.json({...facts(),scopes:approvedScopes});});await a.rejects(h.api.credentialBroker(actor,h.request,h.options()),/VCO_READ_UNCONFIRMED/);a.equal(h.calls.length,1);}
});
test('ciphertext tampering and storage failure deny before provider and never reflect secrets',async()=>{
 const h=await connectedBrokerHarness(),[key,record]=[...h.kv.map].find(([,v])=>v.version===o.VERSION);const raw=Buffer.from(record.connection.ciphertext,'base64url');raw[28]^=1;record.connection.ciphertext=raw.toString('base64url');h.kv.map.set(key,record);
 await a.rejects(h.api.credentialBroker(actor,h.request,h.options()),/^Error: VCO_READ_UNCONFIRMED$/);a.equal(h.calls.length,0);h.kv.get=async()=>{throw Error('SECRET_STORAGE_PAYLOAD');};await a.rejects(h.api.credentialBroker(actor,h.request,h.options()),/^Error: VCO_READ_UNCONFIRMED$/);
});
test('cancelled or deadline-stalled broker response cannot yield a late credential lease',async()=>{
 const h=await connectedBrokerHarness();let finish;h.hook(()=>new Promise(resolve=>{finish=resolve;}));const c=new AbortController(),pending=h.api.credentialBroker(actor,h.request,{...h.options(),signal:c.signal});await new Promise(setImmediate);c.abort();await a.rejects(pending,/VCO_READ_UNCONFIRMED/);finish(Response.json({...facts(),scopes:approvedScopes}));await new Promise(setImmediate);a.equal(h.calls.length,1);
});
test('cancellation bounds stalled owner, Redis and task checks before provider access',async()=>{
 for(const boundary of ['owner','redis','task']){
  const h=await connectedBrokerHarness(),c=new AbortController(),never=()=>new Promise(()=>{});
  const api=boundary==='owner'?o.create({kv:h.kv,env,runtime,assertOwner:never,fetchImpl:async()=>{throw Error('unexpected');}}):h.api;
  if(boundary==='redis')h.kv.get=never;
  const pending=api.credentialBroker(actor,h.request,{...h.options(),signal:c.signal,...(boundary==='task'?{authorize:never}:{})});
  await new Promise(setImmediate);c.abort();await a.rejects(pending,/VCO_READ_UNCONFIRMED/);a.equal(h.calls.length,0);
 }
});
test('lease revalidation remains cancellable when a later storage read stalls',async()=>{
 const h=await connectedBrokerHarness(),c=new AbortController(),lease=await h.api.credentialBroker(actor,h.request,{...h.options(),signal:c.signal});
 h.kv.get=()=>new Promise(()=>{});const pending=lease.revalidate();await new Promise(setImmediate);c.abort();await a.rejects(pending,/VCO_CANCELLED/);
});
test('broker snapshots caller resource before an asynchronous owner check',async()=>{
 const h=await connectedBrokerHarness();let release;const waiting=new Promise(r=>{release=r;});let first=true;
 const api=o.create({kv:h.kv,env,runtime,assertOwner:async()=>{if(first){first=false;await waiting;}return true;},fetchImpl:async url=>{a.match(url,/configuration\/icfg_test\?/);return Response.json({...facts(),scopes:approvedScopes});}});
 const request={...h.request},pending=api.credentialBroker(actor,request,h.options());request.connectionId='icfg_foreign';release();const lease=await pending;a.equal(lease.configurationId,'icfg_test');
});

test('private composed guard accepts only original lease authorizer deployment source and connection',async()=>{
 const h=await connectedBrokerHarness(),options=h.options(),lease=await h.api.credentialBroker(actor,h.request,options);
 const guard=o.guardFor(lease,options.authorize,options.binding,h.request.connectionId);a.equal(typeof guard,'function');a.equal(await guard(),true);
 a.equal(o.guardFor({...lease},options.authorize,options.binding,h.request.connectionId),null);
 a.equal(o.guardFor(lease,async()=>true,options.binding,h.request.connectionId),null);
 for(const binding of [{...options.binding,deploymentId:'dpl_foreign'},{...options.binding,sourceCommit:'c'.repeat(40)}])a.equal(o.guardFor(lease,options.authorize,binding,h.request.connectionId),null);
 a.equal(o.guardFor(lease,options.authorize,options.binding,'icfg_foreign'),null);
});

test('revocation during stalled preconfiguration owner check prevents HTTP after committed revoke',async()=>{
 const h=await connectedBrokerHarness();let checks=0,finish,calls=0;
 const api=o.create({kv:h.kv,env,runtime,assertOwner:async()=>++checks===3?new Promise(r=>finish=r):true,fetchImpl:async()=>{calls++;return Response.json({...facts(),scopes:approvedScopes});}});
 const pending=api.credentialBroker(actor,h.request,h.options());while(!finish)await new Promise(setImmediate);
 await new Promise(setImmediate);await h.api.revoke(actor);finish(true);await a.rejects(pending,/VCO_READ_UNCONFIRMED/);a.equal(calls,0);a.equal((await h.api.status(actor)).status,'revoked');
});

test('broker snapshots exact task binding and rejects malformed bindings before provider access',async()=>{
 const h=await connectedBrokerHarness();for(const binding of [null,{deploymentId:'dpl_test'},{deploymentId:'dpl_test',sourceCommit:runtime.sourceCommit,extra:true},{deploymentId:'foreign',sourceCommit:runtime.sourceCommit}])await a.rejects(h.api.credentialBroker(actor,h.request,{...h.options(),binding}));a.equal(h.calls.length,0);
 let finish;const api=o.create({kv:h.kv,env,runtime,assertOwner:async()=>{if(!finish)await new Promise(r=>finish=r);return true;},fetchImpl:async()=>Response.json({...facts(),scopes:approvedScopes})}),options=h.options(),original={...options.binding},seen=[];
 options.authorize=async binding=>{seen.push({...binding});a.ok(Object.isFrozen(binding));return true;};
 const pending=api.credentialBroker(actor,h.request,options);while(!finish)await new Promise(setImmediate);options.binding.deploymentId='dpl_foreign';finish();const lease=await pending;a.ok(seen.length>=3);a.ok(seen.every(x=>JSON.stringify(x)===JSON.stringify(original)));a.equal(typeof o.guardFor(lease,options.authorize,original,h.request.connectionId),'function');
});

test('composed lease guard rechecks owner task and connection at each later boundary',async()=>{
 for(const denial of ['owner','task','record']){const h=await connectedBrokerHarness();let allowed=true,task=true;
  const api=o.create({kv:h.kv,env,runtime,assertOwner:async()=>allowed,fetchImpl:async()=>Response.json({...facts(),scopes:approvedScopes})}),options={...h.options(),authorize:async()=>task};
  const lease=await api.credentialBroker(actor,h.request,options),guard=o.guardFor(lease,options.authorize,options.binding,h.request.connectionId);a.equal(await guard(),true);
  if(denial==='owner')allowed=false;else if(denial==='task')task=false;else await h.api.revoke(actor);
  await a.rejects(guard());
 }
});
