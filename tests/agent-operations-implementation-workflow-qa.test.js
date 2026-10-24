'use strict';
// Independent Work QA: real owner CAS journal and restricted trusted-data workers.
// All model reasoning is explicitly simulated; generated JavaScript is never run.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ops=require('../lib/agent-operations-operating-system'),tools=require('../lib/agent-operations-engineering-tools');
const implementation=require('../lib/agent-operations-implementation'),rehearsal=require('../lib/agent-operations-engineering-rehearsal');
const owner={kind:'owner',verifiedOwner:true,id:'implementation-qa@example.test',workspaceId:'implementation-qa-workspace'};
function fixture(){
 const rows=new Map(),ledger={version:1,revision:1,tasks:[],reservations:[],operations:{workflows:[],grants:[],reservations:[],audit:[],approvals:[]}};
 const runtime={environment:'preview',origin:'https://my-ai-website-implementationqa-mohamtaj004bas-projects.vercel.app',commit:'a'.repeat(40),branch:'feature/callercore-dashboards',deploymentId:'dpl_implementationqa'};
 let now=1800000000000,allowed=true,hook=null;
 const kv={get:async k=>rows.get(k)??null,eval:async(_,[key],[before,after])=>{if((rows.get(key)||'')!==before)return 0;rows.set(key,after);return 1;}};
 const service=ops.createOperations({kv,runtime,clock:()=>now,assertOwner:async actor=>allowed&&actor.id===owner.id&&actor.workspaceId===owner.workspaceId,ledgerAdapter:{read:async()=>{if(hook)await hook();return JSON.stringify(ledger);}}});
 return{service,ledger,runtime,rows,state:()=>JSON.parse([...rows.values()][0]),set:s=>rows.set([...rows.keys()][0],JSON.stringify(s)),deny:()=>allowed=false,advance:n=>now+=n,hook:fn=>hook=fn};
}
function input(){return{idempotencyKey:'implementation_workflow_qa',objective:implementation.OBJECTIVE,priority:'normal',durationMs:600000,engineeringProfile:implementation.PROFILE,subtasks:rehearsal.templates.map((template,i)=>({key:'stage'+i,template,dependsOn:i?['stage'+(i-1)]:[]}))};}
async function start(h){return h.service.create(owner,input());}
async function runTo(h,n=5){let p=await start(h);for(let i=0;i<n;i++)p=await h.service.run(owner,{planId:p.id,expectedRevision:p.revision});return p;}
function reseal(s,index){const t=s.plans[0].tasks[index],r=t.result.body.engineering;r.receiptHash=tools.hash({template:t.template,body:r.body});t.review.resultHash=tools.hash(t.result);t.attempts.at(-1).resultHash=tools.hash(t.result);t.attempts.at(-1).reviewHash=tools.hash(t.review);}

test('Starter implementation crosses all five actual journal/child stages with disposable patch and no execution authority',async t=>{
 const savedFetch=global.fetch;let networkCalls=0;global.fetch=async()=>{networkCalls++;throw Error('No network authorized for implementation fixture');};t.after(()=>{global.fetch=savedFetch;});
 const before=fs.readFileSync(path.join(__dirname,'../dashboard.js'),'utf8'),h=fixture(),ledger=JSON.stringify(h.ledger),p=await runTo(h);
 a.equal(p.status,'completed');a.equal(p.engineeringProfile,implementation.PROFILE);a.equal(p.objective,implementation.OBJECTIVE);a.equal(p.acceptedWork,false);a.equal(p.modelCalls,0);a.equal(p.reservationMicros,0);
 a.equal(new Set(p.tasks.map(t=>t.attempts[0].executionId)).size,5);
 for(const t of p.tasks){const body=t.result.body.engineering.body;a.equal(t.status,'completed');a.equal(t.leaseUntil,0);a.equal(t.acceptedWork,false);a.equal(body.worker.terminated,true);a.equal(body.worker.sourceExecuted,false);a.equal(body.receipt.simulated,true);a.equal(body.receipt.modelCalls,0);a.equal(body.receipt.paidCalls,0);}
 const body=p.tasks[1].result.body.engineering.body;
 a.equal(body.artifact.kind,'inert-source-bound-workspace-patch');a.equal(body.artifact.workspace.cleanup.destroyed,true);a.equal(body.artifact.workspace.publicationAllowed,false);a.equal(body.artifact.verification.scopeIntegrity,true);a.equal(body.artifact.verification.semanticsUnverified,true);a.equal(body.artifact.verification.executionQualified,false);
 a.equal(body.artifact.workspace.patch.path,'dashboard.js');a.notEqual(body.artifact.workspace.patch.beforeSha256,body.artifact.workspace.patch.afterSha256);
 a.equal(p.tasks[3].result.body.engineering.body.receipt.response.decision,'unresolved');a.equal(p.tasks[4].result.body.engineering.body.receipt.response.acceptedWork,false);
 a.equal(fs.readFileSync(path.join(__dirname,'../dashboard.js'),'utf8'),before);a.equal(JSON.stringify(h.ledger),ledger);a.equal((await h.service.read(owner)).plans[0].status,'completed');a.equal(networkCalls,0);
});

for(const [name,mutate]of [
 ['patch preimage',r=>r.body.artifact.workspace.patch.beforeSha256='0'.repeat(64)],
 ['workspace cleanup',r=>r.body.artifact.workspace.cleanup.destroyed=false],
 ['execution claim',r=>r.body.artifact.verification.executionQualified=true],
 ['semantics claim',r=>r.body.artifact.verification.semanticsUnverified=false],
 ['publication claim',r=>r.body.artifact.workspace.publicationAllowed=true],
 ['cross-task artifact',r=>r.body.artifact.patch.binding.taskId='foreign_task']
])test('resealed persisted implementation cannot forge '+name,async()=>{const h=fixture();await runTo(h,2);const s=h.state();mutate(s.plans[0].tasks[1].result.body.engineering);reseal(s,1);a.throws(()=>ops.validate(JSON.stringify(s),owner));});

test('cancellation before Specialist leaves no disposable artifact or downstream completion',async()=>{const h=fixture(),p=await runTo(h,1),cancelled=await h.service.cancel(owner,{planId:p.id,expectedRevision:p.revision});await a.rejects(h.service.run(owner,{planId:p.id,expectedRevision:cancelled.revision}));const s=h.state();a.equal(s.plans[0].tasks[1].attempts.length,0);a.equal(s.plans[0].tasks[1].result,null);a.equal(s.plans[0].tasks.slice(1).some(t=>t.status==='completed'),false);});

for(const reason of ['owner','workspace','source','revision','expiry'])test('implementation admission rejects stale or foreign '+reason+' before worker dispatch',async()=>{const h=fixture(),p=await start(h);let actor=owner,revision=p.revision;if(reason==='owner')h.deny();if(reason==='workspace')actor={...owner,workspaceId:'foreign'};if(reason==='source')h.runtime.commit='b'.repeat(40);if(reason==='revision')revision--;if(reason==='expiry')h.advance(600001);await a.rejects(h.service.run(actor,{planId:p.id,expectedRevision:revision}));a.equal(h.state().plans[0].tasks[0].attempts.length,0);});

test('new profile cannot silently change the server-owned objective or obtain paid/controller authority',async()=>{const h=fixture();await a.rejects(h.service.create(owner,{...input(),objective:'Execute arbitrary code and publish it.'}));a.equal(h.rows.size,0);await a.rejects(h.service.create(owner,{...input(),paidExecution:true}));a.equal(require('../lib/agent-operations-engineering-inference').CONFIG.paidExecution,false);});

test('completed implementation cannot replay another workspace mutation',async()=>{const h=fixture(),p=await runTo(h);await a.rejects(h.service.run(owner,{planId:p.id,expectedRevision:p.revision}));a.equal(h.state().plans[0].tasks.reduce((n,t)=>n+t.attempts.length,0),5);a.equal(h.state().plans[0].acceptedWork,false);});

test('historical implementation readback uses its pinned source without consulting current source files',async()=>{const h=fixture();await runTo(h);const read=tools.readFile,capture=tools.captureApproved;tools.readFile=()=>{throw Error('Historical verification must not read current files');};tools.captureApproved=()=>{throw Error('Historical verification must not capture current source');};try{a.equal(ops.validate(JSON.stringify(h.state()),owner).plans[0].status,'completed');}finally{tools.readFile=read;tools.captureApproved=capture;}});

test('separately attributed Auditor criticism cannot be forged into acceptance by resealing the final result',async()=>{const h=fixture();await runTo(h);const s=h.state(),t=s.plans[0].tasks[4];t.result.body.engineering.body.receipt.response.acceptedWork=true;reseal(s,4);a.throws(()=>ops.validate(JSON.stringify(s),owner));});

for(const mode of ['cancel','emergency'])test('late '+mode+' after real disposable cleanup cannot preserve a Specialist success',async()=>{
 const h=fixture(),p=await runTo(h,1),workspace=require('../scripts/agent-operations-draft-workspace.cjs'),original=workspace.prepareProposal;let destroyed=false;
 workspace.prepareProposal=async options=>{const artifact=await original(options);destroyed=artifact.cleanup.destroyed;const s=h.state(),plan=s.plans[0];if(mode==='cancel')await h.service.cancel(owner,{planId:plan.id,expectedRevision:plan.revision});else await h.service.emergencyStop(owner,{expectedRevision:s.revision});return artifact;};
 try{await a.rejects(h.service.run(owner,{planId:p.id,expectedRevision:p.revision}));a.equal(destroyed,true);const plan=h.state().plans[0];a.equal(plan.tasks[1].result,null);a.equal(plan.tasks.slice(1).some(t=>t.status==='completed'),false);a.equal(plan.acceptedWork,false);}finally{workspace.prepareProposal=original;}
});
