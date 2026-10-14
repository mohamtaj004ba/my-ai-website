'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const operations=require('../lib/agent-operations-operating-system'),tools=require('../lib/agent-operations-engineering-tools');
const actor={kind:'owner',id:'auditor-owner@example.test',workspaceId:'auditor-workspace',verifiedOwner:true};
function setup(){
 let unavailable=false;const rows=new Map(),kv={get:async k=>{if(unavailable)throw Error('Redis unavailable');return rows.get(k)??null;},eval:async(_,[k],[a,b])=>{if(unavailable)throw Error('Redis unavailable');if((rows.get(k)||'')!==a)return 0;rows.set(k,b);return 1;}},runtime={environment:'preview',origin:'https://auditor-prepare.vercel.app',commit:'a'.repeat(40),branch:'feature/callercore-dashboards'};
 const ledger={version:1,revision:1,tasks:[],reservations:[],operations:{workflows:[],grants:[],reservations:[],audit:[],approvals:[]}};
 const service=operations.createOperations({kv,ledgerAdapter:{read:async()=>JSON.stringify(ledger)},runtime,clock:()=>1000000,assertOwner:async a=>a.id===actor.id});
 return{service,rows,ledger,setUnavailable:v=>unavailable=v};
}
async function start(f){const stages=['engineering-inspect','engineering-propose','engineering-review','engineering-draft','engineering-prepare-demo'];return f.service.create(actor,{idempotencyKey:'auditor_prepare_001',objective:'Prepare fixed deterministic draft data without publishing.',priority:'normal',durationMs:600000,subtasks:stages.map((template,i)=>({key:'s'+i,template,dependsOn:i?['s'+(i-1)]:[]}))});}
async function isolatedCI(fn){const saved=global.fetch;global.fetch=async()=>new Response(JSON.stringify({workflow_runs:[]}));try{return await fn();}finally{global.fetch=saved;}}
test('Auditor: actual five-stage operations reaches restricted child and preserves authoritative source and ledger',()=>isolatedCI(async()=>{
 const f=setup(),source=tools.readFile('dashboard.html'),ledger=JSON.stringify(f.ledger);let p=await start(f);
 for(let i=0;i<5;i++)p=await f.service.run(actor,{planId:p.id,expectedRevision:p.revision});
 assert.equal(p.status,'completed');assert.equal(p.tasks.length,5);assert.equal(p.tasks[4].result.body.engineering.body.artifact.cleanup.destroyed,true);assert.equal(p.tasks[4].result.body.engineering.body.artifact.publicationAllowed,false);assert.equal(p.acceptedWork,false);assert.equal(tools.readFile('dashboard.html'),source);assert.equal(JSON.stringify(f.ledger),ledger);assert.equal((await f.service.read(actor)).plans[0].status,'completed');
}));
test('Auditor: queued preparation cancelled through actual operations cannot initialize child',()=>isolatedCI(async()=>{
 const f=setup();let p=await start(f);for(let i=0;i<4;i++)p=await f.service.run(actor,{planId:p.id,expectedRevision:p.revision});
 p=await f.service.cancel(actor,{planId:p.id,expectedRevision:p.revision});assert.equal(p.tasks[4].status,'cancelled');assert.equal(p.tasks[4].attempts.length,0);await assert.rejects(f.service.run(actor,{planId:p.id,expectedRevision:p.revision}),/OPS_PLAN_STALE/);
}));
test('Auditor: persisted draft cannot claim publication even with outer hashes recomputed',()=>isolatedCI(async()=>{
 const f=setup();let p=await start(f);for(let i=0;i<5;i++)p=await f.service.run(actor,{planId:p.id,expectedRevision:p.revision});
 const [key,raw]=[...f.rows.entries()][0],s=JSON.parse(raw),t=s.plans[0].tasks[4];t.result.body.engineering.body.artifact.publicationAllowed=true;
 const r=t.result.body.engineering;r.receiptHash=tools.hash({stage:r.stage,binding:r.binding,dependencyRefs:r.dependencyRefs,body:r.body});t.review.resultHash=tools.hash(t.result);t.attempts[0].resultHash=tools.hash(t.result);t.attempts[0].reviewHash=tools.hash(t.review);f.rows.set(key,JSON.stringify(s));await assert.rejects(f.service.read(actor),/DRAFT_AUTHORITY_DENIED/);
}));
for(const scenario of ['cancellation','Redis failure'])test('Auditor: actual mid-CI '+scenario+' aborts pending transport and cannot persist completed work',async()=>{
 const saved=global.fetch,f=setup();let arrived,aborted=false;const entered=new Promise(r=>arrived=r);let keepAlive;
 global.fetch=async(_url,options)=>{arrived();return new Promise((resolve,reject)=>{keepAlive=setTimeout(()=>reject(Error('test safety deadline')),2000);options.signal.addEventListener('abort',()=>{aborted=true;clearTimeout(keepAlive);reject(Error('aborted'));},{once:true});});};
 try{let p=await start(f);const pending=f.service.run(actor,{planId:p.id,expectedRevision:p.revision});await entered;
  if(scenario==='cancellation'){p=(await f.service.read(actor)).plans[0];await f.service.cancel(actor,{planId:p.id,expectedRevision:p.revision});}else f.setUnavailable(true);
  await assert.rejects(pending);assert.equal(aborted,true);const state=JSON.parse([...f.rows.values()][0]);assert.notEqual(state.plans[0].tasks[0].status,'completed');assert.equal(state.plans[0].tasks[0].result,null);assert.equal(state.plans[0].acceptedWork,false);
 }finally{clearTimeout(keepAlive);global.fetch=saved;}
});
test('Auditor: transient Redis failure cannot turn guard-aborted CI into completed work after recovery',async()=>{
 const saved=global.fetch,f=setup();let arrived,aborted=false,keepAlive;const entered=new Promise(r=>arrived=r);
 global.fetch=async(_url,options)=>{arrived();return new Promise((resolve,reject)=>{keepAlive=setTimeout(()=>reject(Error('test safety deadline')),2000);options.signal.addEventListener('abort',()=>{aborted=true;f.setUnavailable(false);clearTimeout(keepAlive);reject(Error('aborted after transient storage outage'));},{once:true});});};
 try{const p=await start(f),pending=f.service.run(actor,{planId:p.id,expectedRevision:p.revision});await entered;f.setUnavailable(true);await assert.rejects(pending,/OPS_EXECUTION_REVOKED/);assert.equal(aborted,true);const state=await f.service.read(actor);assert.equal(state.plans[0].tasks[0].status,'blocked');assert.equal(state.plans[0].tasks[0].result,null);assert.equal(state.plans[0].tasks[0].failure,'OPS_EXECUTION_REVOKED');assert.equal(state.plans[0].acceptedWork,false);
 }finally{clearTimeout(keepAlive);global.fetch=saved;}
});
