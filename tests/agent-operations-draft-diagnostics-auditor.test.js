'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHandler}=require('../lib/agent-operations-api');
async function call(message,{owner=true}={}){
 let executed=0,status,body;const handler=createHandler({env:{VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'false'},getSession:async()=>({email:'owner@example.test',workspaceId:'alpha'}),getMember:async()=>({email:'owner@example.test',workspaceId:'alpha',role:'admin'}),getWorkspace:async()=>({ownerEmail:owner?'owner@example.test':'other@example.test'}),rateLimit:async()=>({limited:false}),operations:{run:async()=>{executed++;const e=Error(message);e.stdout='Bearer hidden-secret';e.stderr='/private/runtime.env';e.token='private-token';throw e;}}});
 await handler({method:'POST',headers:{host:'diagnostic.vercel.app',origin:'https://diagnostic.vercel.app'},query:{},body:{action:'operations-run',input:{planId:'op_test',expectedRevision:1}}},{setHeader(){},status(n){status=n;return this;},json(v){body=v;return this;}});return{executed,status,body};
}
for(const code of ['DRAFT_TIMEOUT','DRAFT_START_FAILED','DRAFT_CLEANUP_FAILED'])test('Auditor: exact '+code+' survives guarded API without raw child payload',async()=>{
 const r=await call(code);assert.equal(r.status,409);assert.equal(r.body.code,code);assert.equal(r.executed,1);assert.deepEqual(Object.keys(r.body).sort(),['code','error']);for(const text of ['hidden-secret','runtime.env','private-token'])assert.equal(JSON.stringify(r.body).includes(text),false);
});
for(const message of ['DRAFT_TIMEOUT Bearer hidden-secret','DRAFT_START_FAILED\n/private/runtime.env','DRAFT_timeout','prefix DRAFT_TIMEOUT'])test('Auditor: untrusted draft error text is not exposed as diagnostic code',async()=>{
 const r=await call(message);assert.equal(r.status,409);assert.equal(r.body.code,'BROKER_STORAGE_UNCONFIRMED');assert.equal(JSON.stringify(r.body).includes(message),false);assert.equal(JSON.stringify(r.body).includes('hidden-secret'),false);
});
test('Auditor: diagnostic mapping does not grant nonowner execution',async()=>{
 const r=await call('DRAFT_TIMEOUT',{owner:false});assert.equal(r.status,403);assert.equal(r.executed,0);assert.equal(Object.hasOwn(r.body,'code'),false);
});
