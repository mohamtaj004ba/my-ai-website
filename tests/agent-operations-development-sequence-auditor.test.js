'use strict';
// Independent adversarial journal tests; all configuration ACKs are fixtures.
const {test}=require('node:test'),a=require('node:assert/strict'),p=require('../lib/agent-operations-engineering-provider-v2'),config=require('../lib/agent-operations-engineering-configuration'),seq=require('../lib/agent-operations-engineering-sequence');
function fixture(){
 const now=1800000000000,c={binding:{planId:'audit_plan',taskId:'audit_task',ownerHash:'a'.repeat(64),workspaceHash:'b'.repeat(64),runtime:{sourceCommit:'c'.repeat(40),deploymentId:'dpl_before',origin:'https://my-ai-website-before-mohamtaj004bas-projects.vercel.app',branch:config.SCOPE.branch,release:{version:'organization-contracts-v4',digest:'d'.repeat(64)}}},assignment:p.DEVELOPMENT_TRIAL.objective,evidence:require('../lib/agent-operations-implementation').snapshot().evidence},review={workQaHash:'1'.repeat(64),workAuditorHash:'2'.repeat(64),sourceCommit:c.binding.runtime.sourceCommit,releaseHash:c.binding.runtime.release.digest},o={approvals:[],grants:[],workflows:[],reservations:[]},id='sequence_'+'3'.repeat(32),intent='refresh_'+'4'.repeat(32),values=config.expected(c,review);
 config.claim(o,c,{id:intent,sequenceIntentId:id,scope:{...config.SCOPE},values,review},now);
 for(const [i,step]of config.STEPS.entries()){config.step(o,c,{id:intent,step,phase:'dispatch'},now+i*2+1);config.step(o,c,{id:intent,step,phase:'acknowledged'},now+i*2+2);}
 c.binding.runtime={...c.binding.runtime,deploymentId:'dpl_after',origin:'https://my-ai-website-after-mohamtaj004bas-projects.vercel.app'};
 config.complete(o,c,{id:intent,providerMetadataHash:'5'.repeat(64)},now+100,values);
 seq.registerDevelopment(o,c,{id,configurationIntentId:intent,review,expiresAt:now+3600000},now+200);
 const approval={id:'pilot_'+'6'.repeat(32),workflowId:'wf_'+'7'.repeat(32),maxMicros:1000000,countPricing:{authorizationId:p.DEVELOPMENT_TRIAL.authorizationId,evidenceHash:p.hash(p.DEVELOPMENT_TRIAL)},sequence:{id,attempt:1}};
 return{o,c,id,now,approval};
}
function corrupt(f){const entry=f.o.engineeringSequences[0].enrollments[0];entry.configurationHash='f'.repeat(64);const {hash,...raw}=entry;entry.hash=p.hash(raw);return entry;}
test('rehashed enrollment cannot substitute configuration completion before approval claim',()=>{const f=fixture();corrupt(f);seq.valid(f.o.engineeringSequences[0]);a.throws(()=>seq.claim(f.o,f.c,f.approval,f.now+300),/ENG_CONFIG_|ENG_SEQUENCE_/);a.equal(f.o.engineeringSequences[0].attempts.length,0);a.equal(f.o.reservations.length,0);});
test('rehashed enrollment and matching attempt reference cannot authorize provider dispatch',()=>{const f=fixture();seq.claim(f.o,f.c,f.approval,f.now+300);const entry=corrupt(f);f.o.engineeringSequences[0].attempts[0].enrollmentHash=entry.hash;seq.valid(f.o.engineeringSequences[0]);a.throws(()=>seq.assert(f.o,f.c,f.approval,f.now+301),/ENG_CONFIG_|ENG_SEQUENCE_/);a.equal(f.o.reservations.length,0);});
