'use strict';
// Reuses the real five-stage owner controller/CAS and restricted data-copy child.
// Model reasoning is an explicit fixture. No dynamic test provider or network.
const ops=require('../../lib/agent-operations-operating-system'),impl=require('../../lib/agent-operations-implementation'),tasks=require('../../lib/agent-operations-implementation-tasks'),templates=require('../../lib/agent-operations-engineering-rehearsal').templates;
function historicalFixture(){const original=impl.sourceEvidence;impl.sourceEvidence=c=>tasks.descriptor(c)?tasks.historicalEvidence(c):original(c);return()=>{impl.sourceEvidence=original;};}
function setup(){const rows=new Map(),owner={kind:'owner',verifiedOwner:true,id:'bounded-fixture@example.test',workspaceId:'bounded-fixture'},runtime={environment:'preview',origin:'https://my-ai-website-boundedfixture-mohamtaj004bas-projects.vercel.app',commit:'a'.repeat(40),branch:'feature/callercore-dashboards',deploymentId:'dpl_boundedFixture'},ledger={version:1,revision:1,tasks:[],reservations:[],operations:{workflows:[],grants:[],reservations:[],audit:[],approvals:[]}};
 const service=ops.createOperations({kv:{get:async k=>rows.get(k)??null,eval:async(_,[key],[before,after])=>{if((rows.get(key)||'')!==before)return 0;rows.set(key,after);return 1;}},runtime,assertOwner:async a=>a.id===owner.id&&a.workspaceId===owner.workspaceId,ledgerAdapter:{read:async()=>JSON.stringify(ledger)}});
 const descriptor=tasks.list()[0],input={idempotencyKey:'bounded_notification_fixture',objective:descriptor.objective,priority:'normal',durationMs:600000,engineeringProfile:impl.PROFILE,subtasks:templates.map((template,i)=>({key:'task'+(i+1),template,dependsOn:i?['task'+i]:[]}))};
 return{service,owner,runtime,input,rows,ledger,state:()=>JSON.parse([...rows.values()][0])};
}
async function run(f){let plan=await f.service.create(f.owner,f.input);for(let n=0;n<5;n++)plan=await f.service.run(f.owner,{planId:plan.id,expectedRevision:plan.revision});return plan;}
// Test-only explicit historical filesystem fixture. Never imported by runtime code.
function historicalSourceFixture(assignment){const tools=require('../../lib/agent-operations-engineering-tools'),a=require('node:assert/strict'),original=tools.captureApproved,current=original(),old=tasks.snapshot({assignment});for(const file of old.manifest.files)if(file.path!=='dashboard.js')a.equal(tools.hash(current.texts[file.path]),file.sha256,'Historical replay dependencies changed');const value={texts:{...current.texts,'dashboard.js':old.text},manifest:old.manifest};tools.captureApproved=()=>structuredClone(value);return()=>{tools.captureApproved=original;};}
module.exports={setup,run,historicalFixture,historicalSourceFixture};
