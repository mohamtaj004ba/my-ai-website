'use strict';
// Taxonomy is not an execution grant. No lead/model/tool permission is activated here.
const VERSION='department-routing-v1';
const departments=[
 {id:'engineering-product',name:'Engineering & Product',roles:['website-ui','dashboard','backend-integration','voice-systems']},
 {id:'quality-security-reliability',name:'Quality, Security & Reliability',roles:['independent-qa','engineering-auditor','security-reviewer','reliability-recovery'],independentVeto:true},
 {id:'business-growth',name:'Business & Growth',roles:['marketing','sales-leads','industry-research']},
 {id:'finance-operations',name:'Finance & Operations',roles:['finance-cost-control','operational-reporting','onboarding-process']}
];
const responsibilities={
 'website-ui':'Website evidence and interface inspection; no site edits.',dashboard:'Administrative and client interface evidence; no customer changes.',
 'backend-integration':'Contracts and dependency inspection; no credentials, integrations or network changes.',
 'voice-systems':'Internal voice engineering; distinct from customer-facing AI receptionists. No live calls or telephony access.',
 'independent-qa':'Verify results independently; no implementation or acceptance override.',
 'engineering-auditor':'Challenge assumptions and negative paths; mandatory security failures escalate directly to owner.',
 'security-reviewer':'Identity, isolation and permission assessment; security veto cannot be overridden by Chief.',
 'reliability-recovery':'Observe incidents and bounded internal recovery; no provider retries or authority restoration.',
 marketing:'Proposed content and campaign analysis only; no publication.',
 'sales-leads':'Authorized lead analysis only; no outreach or CRM writes.',
 'industry-research':'Evidence-based research planning; no unrestricted browsing.',
 'finance-cost-control':'Read retained reservations and recorded costs; cannot settle uncertainty or change budgets.',
 'operational-reporting':'Consolidate verified internal state and limitations.',
 'onboarding-process':'Process analysis; no client onboarding mutations.'
};
const templates=Object.freeze({
 'engineering-inspect':{name:'Read deployed client-dashboard source',role:'dashboard',department:'engineering-product',risk:'critical',tool:'inspect-client-dashboard-source'},
 'engineering-propose':{name:'Prepare evidence-linked engineering proposals',role:'backend-integration',department:'engineering-product',risk:'critical',tool:'propose-engineering-only'},
 'engineering-review':{name:'Check engineering evidence without acceptance',role:'independent-qa',department:'quality-security-reliability',risk:'critical',tool:'verify-engineering-evidence'},
 'engineering-draft':{name:'Record disabled isolated-draft contract',role:'backend-integration',department:'engineering-product',risk:'critical',tool:'describe-disabled-draft'},
 'evidence-inventory':{name:'Evidence and review inventory',role:'website-ui',department:'engineering-product',risk:'substantial',tool:'read-owned-evidence-manifests'},
 'budget-audit':{name:'Reservations and usage report',role:'finance-cost-control',department:'finance-operations',risk:'critical',tool:'read-owned-accounting'},
 'runtime-health':{name:'Task, lease and incident report',role:'reliability-recovery',department:'quality-security-reliability',risk:'critical',tool:'read-owned-runtime'},
 'contract-readiness':{name:'Current release contract report',role:'backend-integration',department:'engineering-product',risk:'critical',tool:'read-release-contracts'}
});
function directory(){return{version:VERSION,engineeringTools:require('./agent-operations-engineering-tools').capabilities(),chief:{role:'chief-of-staff',preferredModel:'gpt-6.1-sol',reasoning:'medium',status:'deterministic-planner-only',paidExecution:false,canOverrideAcceptance:false},departments:departments.map(d=>({...d,lead:{status:'logical-role-no-model-call'},roles:d.roles.map(id=>({id,responsibility:responsibilities[id],reportsTo:d.id,escalatesTo:'workspace-owner',status:Object.values(templates).some(t=>t.role===id)?'internal-deterministic-substitute':'profile-only-inactive',allowedTools:Object.values(templates).filter(t=>t.role===id).map(t=>t.tool),paidExecution:false,writesEnabled:false,approvalRequirements:'Fresh owner session and exact bounded Preview task; any external or write tool needs separate authorization.'}))})),templates:Object.entries(templates).map(([id,t])=>({id,...t,requiredTemplate:require('./agent-operations-engineering').predecessor(id),modelCalls:0,reservationMicros:0,execution:id.startsWith('engineering-')?'real-source-tool-with-deterministic-reasoning':'deterministic-internal-report',review:'backend-contract-verifier',externalTools:[]}))};}
module.exports={VERSION,departments,templates,directory};
