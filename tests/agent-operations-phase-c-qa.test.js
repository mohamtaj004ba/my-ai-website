'use strict';
// Independent real-tool boundary checks. Only curated tracked source is read;
// all durable tasks/transport are synthetic and no provider or writer is used.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ops=require('../lib/agent-operations-operating-system'),tools=require('../lib/agent-operations-engineering-tools'),engineering=require('../lib/agent-operations-engineering');
const owner={kind:'owner',id:'owner@example.test',workspaceId:'alpha',verifiedOwner:true};
const stages=['engineering-inspect','engineering-propose','engineering-review','engineering-draft'];
function assignment(key='phase_c_assignment_001'){return{idempotencyKey:key,objective:'Inspect curated deployed client source, prepare evidence-linked proposals, review and retain an inert draft descriptor.',priority:'normal',durationMs:600000,subtasks:stages.map((template,i)=>({key:'stage'+i,template,dependsOn:i?['stage'+(i-1)]:[]}))};}
const command=p=>({planId:p.id,expectedRevision:p.revision});
function fixture(){
 let now=1000000,allowed=true,reads=0,hook=null,ledger={version:1,revision:1,tasks:[],reservations:[{taskId:'historical_uncertainty',mode:'pilot',ceilingMicros:2200000,status:'pending'}],operations:{workflows:[],grants:[],reservations:[],audit:[],approvals:[]}};
 const rows=new Map(),runtime={environment:'preview',origin:'https://my-ai-website-phasecfixture-mohamtaj004bas-projects.vercel.app',commit:'a'.repeat(40),branch:'feature/callercore-dashboards'},kv={get:async k=>rows.get(k)??null,eval:async(_,[k],[a,b])=>{if((rows.get(k)||'')!==a)return 0;rows.set(k,b);return 1;}},ledgerAdapter={read:async()=>{reads++;if(hook)await hook(reads);return JSON.stringify(ledger);}},service=ops.createOperations({kv,ledgerAdapter,runtime,clock:()=>now,assertOwner:async a=>allowed&&a.id===owner.id&&['alpha','beta'].includes(a.workspaceId)});
 return{service,rows,runtime,ledger:()=>ledger,journal:()=>JSON.parse([...rows.values()][0]),hook:f=>{reads=0;hook=f;},advance:n=>now+=n,authorize:v=>allowed=v};
}
async function through(f,count=4){let p=await f.service.create(owner,assignment());for(let i=0;i<count;i++)p=await f.service.run(owner,command(p));return p;}
function reseal(task){const r=task.result.body.engineering;r.receiptHash=tools.hash({stage:r.stage,binding:r.binding,dependencyRefs:r.dependencyRefs,body:r.body});task.review.resultHash=tools.hash(task.result);task.attempts.at(-1).resultHash=tools.hash(task.result);task.attempts.at(-1).reviewHash=tools.hash(task.review);}

test('actual curated reads feed four-stage durable proposals and disabled draft without changing source or execution accounting',async()=>{
 const f=fixture(),oldLedger=JSON.stringify(f.ledger()),before=tools.manifest(),p=await through(f);
 assert.equal(p.status,'completed');assert.equal(p.modelCalls,0);assert.equal(p.reservationMicros,0);assert.equal(p.acceptedWork,false);assert.equal(p.report.businessAcceptance,'not-granted');
 assert.deepEqual(p.tasks.map(t=>t.template),stages);assert(p.tasks.every(t=>t.attempts.length===1&&t.leaseUntil===0&&t.internalVerified&&t.review.acceptedWork===false&&t.review.substantive==='not-assessed'));
 const evidence=p.tasks[0].result.body.engineering.body;assert.equal(evidence.manifestHash,tools.hash(before));assert.equal(evidence.previewIdentity.remoteProbe,false);
 for(const o of evidence.observations){const actual=tools.readFile(o.evidence.path);assert.equal(actual.split('\n')[o.evidence.line-1],o.evidence.text);assert.equal(tools.hash(actual),o.evidence.sha256);assert.equal(tools.hash(o.evidence.text),o.evidence.excerptHash);}
 const proposal=p.tasks[1].result.body.engineering.body;assert.equal(proposal.reasoning,'deterministic-rule-based-not-model');assert.equal(proposal.proposals.length,evidence.observations.length);assert(proposal.proposals.every(x=>x.ownerApprovalRequired&&x.independentDecision==='unresolved'&&x.severity==='unassessed'));
 const review=p.tasks[2].result.body.engineering.body;assert(review.decisions.every(x=>x.decision==='unresolved'));assert.equal(review.publicationAuthorized,false);
 const chief=p.report.engineering;assert.equal(chief.reasoning,'deterministic-consolidation-not-model');assert.equal(chief.acceptedWork,false);assert.equal(chief.groups.length,1);assert.equal(chief.groups[0].findings.length,3);
 for(const finding of chief.groups[0].findings){const original=proposal.proposals.find(x=>x.id===finding.originalProposal.id),decision=review.decisions.find(x=>x.proposalId===original.id);assert.deepEqual(finding.originalProposal,original);assert.equal(finding.decision,decision.decision);assert.equal(finding.reason,decision.reason);assert.deepEqual(finding.evidenceHashes,decision.evidenceHashes);assert.equal(finding.uncertainty,original.uncertainty);assert.equal(finding.ownerApprovalRequired,true);}
 const draft=p.tasks[3].result.body.engineering.body;assert.equal(draft.workspace.status,'not-created-write-disabled');assert.deepEqual(draft.changes,[]);for(const k of ['network','shell','credentials','customerData','apply','commit','push','deploy'])assert.equal(draft.workspace[k],false);
 assert.deepEqual(tools.manifest(),before);assert.equal(JSON.stringify(f.ledger()),oldLedger);assert.equal((await f.service.read(owner)).plans[0].id,p.id);
 const [key,raw]=[...f.rows.entries()][0];try{for(const mutate of [r=>r.groups[0].findings[0].decision='accept',r=>r.groups[0].findings[0].reason='Chief overrides the reviewer.',r=>r.groups[0].findings.pop(),r=>r.groups[0].findings[0].originalProposal.problem='Invented original finding']){const s=JSON.parse(raw);mutate(s.plans[0].report.engineering);f.rows.set(key,JSON.stringify(s));await assert.rejects(f.service.read(owner),/OPS_STATE_INVALID/);}}finally{f.rows.set(key,raw);}
});

test('Chief consolidation cannot invent a review when a source-and-proposal-only assignment completes',async()=>{
 const f=fixture(),input=assignment('phase_c_without_review');input.subtasks=input.subtasks.slice(0,2);let p=await f.service.create(owner,input);for(let i=0;i<2;i++)p=await f.service.run(owner,command(p));assert.equal(p.status,'completed');
 const group=p.report.engineering.groups[0];assert.equal(group.reviewTaskId,null);assert.equal(group.reviewHash,null);assert.equal(group.findings.length,3);assert(group.findings.every(f=>f.reviewStatus==='not-performed'&&f.decision===null&&f.evidenceHashes.length===0&&f.ownerApprovalRequired));assert.equal(p.acceptedWork,false);
});

test('adapter rejects arbitrary paths, URLs, private evidence and malformed source bytes',()=>{
 for(const name of ['../dashboard.js','./dashboard.js','.env','lib/agent-operations-api.js','docs/qa-evaluation/phase-a-cases.json','https://callercore.com','dashboard.js%00','Dashboard.js'])assert.throws(()=>tools.readFile(name),/ENG_FILE_DENIED/);
 for(const bytes of [Buffer.from([0]),Buffer.from([0xc0,0x80]),Buffer.alloc(700001,65),Buffer.from('sk-proj-'+'X'.repeat(28)),Buffer.from('-----BEGIN PRIVATE KEY-----')])assert.throws(()=>tools.safeText(bytes),/ENG_SOURCE_BOUNDS|ENG_SOURCE_ENCODING|ENG_SOURCE_SECRET/);
 assert.throws(()=>tools.inspect('arbitrary-preview-url'),/ENG_PROFILE_DENIED/);
 const c=tools.capabilities();assert.equal(c.writes,false);assert.equal(c.paidDispatch,false);assert.match(c.browser,/unavailable/);assert.match(c.preview,/no remote HTTP/);
});

test('actual source manifest mismatch fails before publication and remains a non-recoverable engineering diagnostic',async()=>{
 const f=fixture(),p=await f.service.create(owner,assignment()),lock=require('../lib/agent-operations-engineering-source-lock.json'),old=lock.files[0].sha256;
 try{lock.files[0].sha256='0'.repeat(64);assert.throws(()=>tools.inspect(tools.PROFILE),/ENG_SOURCE_DRIFT/);await assert.rejects(f.service.run(owner,command(p)),/ENG_SOURCE_DRIFT/);const stored=f.journal().plans[0];assert.equal(stored.tasks[0].failure,'ENG_SOURCE_DRIFT');assert.equal(stored.tasks[0].result,null);await assert.rejects(f.service.recover(owner,{...command(stored),taskId:stored.tasks[0].id}),/OPS_RECOVERY_DENIED/);}finally{lock.files[0].sha256=old;}
 assert.equal(tools.inspect(tools.PROFILE).manifestHash,tools.hash(lock));
});

test('missing or ambiguous direct engineering predecessors fail at actual plan admission',async()=>{
 const f=fixture();for(const input of [(()=>{const a=assignment();a.subtasks[1].dependsOn=[];return a;})(),{...assignment(),subtasks:[{key:'one',template:'engineering-inspect',dependsOn:[]},{key:'two',template:'engineering-inspect',dependsOn:[]},{key:'proposal',template:'engineering-propose',dependsOn:['one','two']}]}])await assert.rejects(f.service.create(owner,input),/ENG_DEPENDENCY_REQUIRED/);
 assert.equal(f.rows.size,0);
});

test('client-supplied source paths, tool profiles or write permissions cannot expand assignment scope',async()=>{
 const f=fixture();for(const mutate of [p=>p.sourcePath='../.env',p=>p.profile='production',p=>p.subtasks[0].allowedFiles=['lib/private.js'],p=>p.subtasks[3].apply=true,p=>p.subtasks[3].template='engineering-apply']){const p=assignment();mutate(p);await assert.rejects(f.service.create(owner,p),/OPS_PLAN_INVALID|OPS_ROUTING_DENIED/);}assert.equal(f.rows.size,0);
});

test('engineering source tools require the exact approved feature branch at admission and execution',async()=>{
 for(const branch of [undefined,'main','feature/unapproved']){const f=fixture();if(branch===undefined)delete f.runtime.branch;else f.runtime.branch=branch;await assert.rejects(f.service.create(owner,assignment()),/ENG_BRANCH_DENIED/);assert.equal(f.rows.size,0);}
 const f=fixture(),p=await f.service.create(owner,assignment());f.runtime.branch='main';await assert.rejects(f.service.run(owner,command(p)),/OPS_PLAN_STALE/);assert.equal(f.journal().plans[0].tasks[0].attempts.length,0);
});

test('same owner in a foreign workspace cannot run, read or resume an engineering plan',async()=>{
 const f=fixture(),p=await f.service.create(owner,assignment()),foreign={...owner,workspaceId:'beta'};assert.equal((await f.service.read(foreign)).plans.length,0);await assert.rejects(f.service.run(foreign,command(p)),/OPS_PLAN_STALE/);await assert.rejects(f.service.recover(foreign,{...command(p),taskId:p.tasks[0].id}),/OPS_RECOVERY_DENIED/);assert.equal(f.journal().plans[0].tasks[0].attempts.length,0);
});

test('cancellation before a real tool boundary prevents source access',async()=>{
 const f=fixture(),p=await f.service.create(owner,assignment()),original=tools.inspect;let calls=0;
 tools.inspect=(...a)=>{calls++;return original(...a);};
 try{f.hook(async n=>{if(n===1)await f.service.cancel(owner,command(f.journal().plans[0]));});await assert.rejects(f.service.run(owner,command(p)),/OPS_EXECUTION_REVOKED/);assert.equal(calls,0);}finally{tools.inspect=original;f.hook(null);}
 assert.equal(f.journal().plans[0].status,'cancelled');
});

test('late tool result cannot publish after cancellation or lease expiry',async()=>{
 for(const reason of ['cancel','lease']){const f=fixture(),p=await f.service.create(owner,assignment()),original=tools.inspect;let calls=0;tools.inspect=(...a)=>{calls++;return original(...a);};
  try{f.hook(async n=>{if(n===2){if(reason==='cancel')await f.service.cancel(owner,command(f.journal().plans[0]));else f.advance(30001);}});await assert.rejects(f.service.run(owner,command(p)),/OPS_EXECUTION_REVOKED/);assert(calls>0,'exercise real tool reads before the late publication denial');}finally{tools.inspect=original;f.hook(null);}
  const stored=f.journal().plans[0];assert.equal(stored.tasks[0].result,null);assert.equal(stored.acceptedWork,false);assert(stored.tasks.slice(1).every(t=>t.attempts.length===0));assert.equal(f.ledger().reservations[0].status,'pending');
 }
});

test('source-ledger change after actual read blocks evidence, and stale runtime cannot start a tool',async()=>{
 const f=fixture(),p=await f.service.create(owner,assignment());f.hook(n=>{if(n===2){f.ledger().revision++;f.ledger().reservations.push({taskId:'new_uncertainty',mode:'pilot',ceilingMicros:300000,status:'pending'});}});await assert.rejects(f.service.run(owner,command(p)),/OPS_SOURCE_CHANGED/);f.hook(null);assert.equal(f.journal().plans[0].tasks[0].result,null);
 const g=fixture(),q=await g.service.create(owner,assignment());g.runtime.commit='b'.repeat(40);await assert.rejects(g.service.run(owner,command(q)),/OPS_PLAN_STALE/);assert.equal(g.journal().plans[0].tasks[0].attempts.length,0);
});

test('forged review acceptance or cross-owner bindings fail even after content hashes are recomputed',async()=>{
 const f=fixture();await through(f,3);const [key,raw]=[...f.rows.entries()][0];
 for(const mutate of [t=>t.result.body.engineering.body.decisions[0].decision='accept',t=>t.result.body.engineering.body.publicationAuthorized=true,t=>t.result.body.engineering.binding.ownerHash='f'.repeat(64)]){const s=JSON.parse(raw),t=s.plans[0].tasks[2];mutate(t);reseal(t);f.rows.set(key,JSON.stringify(s));await assert.rejects(f.service.read(owner),/ENG_REVIEW_DENIED|ENG_RECEIPT_INVALID|ENG_EVIDENCE_SUBSTITUTED/);}f.rows.set(key,raw);
});

test('disabled draft cannot become a write-capable descriptor by resealing stored content',async()=>{
 const f=fixture();await through(f);const [key,raw]=[...f.rows.entries()][0];for(const mutate of [w=>w.apply=true,w=>w.commit=true,w=>w.push=true,w=>w.deploy=true,w=>w.status='created']){const s=JSON.parse(raw),t=s.plans[0].tasks[3];mutate(t.result.body.engineering.body.workspace);reseal(t);f.rows.set(key,JSON.stringify(s));await assert.rejects(f.service.read(owner),/ENG_WRITE_DENIED|ENG_EVIDENCE_SUBSTITUTED/);}f.rows.set(key,raw);
});

test('authenticated actual API routes the complete real-source workflow and denies worker/foreign-origin dispatch',async()=>{
 const f=fixture(),{createHandler}=require('../lib/agent-operations-api'),env={VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'false',CALLERCORE_AGENTOPS_WORKER_SECRET:'w'.repeat(40)},handler=createHandler({env,operations:f.service,store:{scope:{},read:async()=>structuredClone(f.ledger())},getSession:async()=>({email:owner.id,workspaceId:owner.workspaceId}),getMember:async()=>({email:owner.id,workspaceId:owner.workspaceId,role:'admin'}),getWorkspace:async()=>({ownerEmail:owner.id}),rateLimit:async()=>({limited:false})});
 async function call(action,input,headers={}){let status,body;await handler({method:'POST',query:{},body:{action,input},headers:{host:new URL(f.runtime.origin).host,origin:f.runtime.origin,...headers}},{setHeader(){},status(n){status=n;return this;},json(v){body=v;return this;}});return{status,body};}
 const original=JSON.stringify(f.ledger());let r=await call('operations-create',assignment());assert.equal(r.status,200);let p=r.body.operatingSystem;for(let i=0;i<4;i++){r=await call('operations-run',command(p));assert.equal(r.status,200);p=r.body.operatingSystem;}assert.equal(p.status,'completed');assert.equal(p.acceptedWork,false);assert.equal(JSON.stringify(f.ledger()),original);
 for(const headers of [{authorization:'Bearer '+env.CALLERCORE_AGENTOPS_WORKER_SECRET},{origin:'https://foreign.example'}]){const denied=await call('operations-run',command(p),headers);assert.equal(denied.status,403);}
});
