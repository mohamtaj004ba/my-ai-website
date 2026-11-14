const test=require('node:test');
const assert=require('node:assert/strict');
const {
  STALE_UNCONVERTED_PROSPECT_MS,prospectLastMeaningfulAt,prospectHasCustomerRelationship,
  deidentifyProspectForAnalytics,staleUnconvertedProspectEligible,planStaleProspectDeidentification
}=require('../lib/prospect-retention');

const day=24*60*60*1000;
const consent=(status='not_granted',recordedAt=1)=>({status,source:'contact_form',noticeVersion:'2026-09-29',recordedAt});

test('stale prospect retention uses a 12-month window and only meaningful interaction timestamps',()=>{
  assert.equal(STALE_UNCONVERTED_PROSPECT_MS,365*day);
  const p={id:'p1',createdAt:10,updatedAt:20,lastContactAt:30,lastRepliedAt:40,nextFollowUpAt:9999999999999};
  assert.equal(prospectLastMeaningfulAt(p),40);
});

test('customer-linked, converted, consented, recent, timestamp-less and already de-identified records are ineligible',()=>{
  const now=500*day,old=now-366*day,base={id:'p',stage:'new',createdAt:old,updatedAt:old,marketingEmailConsent:consent()};
  assert.equal(staleUnconvertedProspectEligible(base,now),true);
  assert.equal(staleUnconvertedProspectEligible({...base,updatedAt:now-10*day},now),false);
  assert.equal(staleUnconvertedProspectEligible({...base,stage:'converted'},now),false);
  assert.equal(staleUnconvertedProspectEligible({...base,workspaceId:'workspace-1'},now),false);
  assert.equal(staleUnconvertedProspectEligible({...base,stripeCustomerId:'cus_1'},now),false);
  assert.equal(staleUnconvertedProspectEligible({...base,stripeSubscriptionId:'sub_1'},now),false);
  assert.equal(staleUnconvertedProspectEligible(base,now,{consentActive:true}),false);
  assert.equal(staleUnconvertedProspectEligible({...base,marketingEmailConsent:consent('granted')},now),false);
  assert.equal(staleUnconvertedProspectEligible({...base,marketingEmailConsent:null},now),false);
  assert.equal(staleUnconvertedProspectEligible({id:'p2',stage:'new'},now),false);
  assert.equal(staleUnconvertedProspectEligible({...base,privacyState:'deidentified'},now),false);
  assert.equal(prospectHasCustomerRelationship({...base,stage:'converted'}),true);
});

test('exact 12-month boundary is eligible but one millisecond inside the window is not',()=>{
  const now=600*day,cutoff=now-365*day;
  assert.equal(staleUnconvertedProspectEligible({id:'edge',stage:'lost',updatedAt:cutoff,marketingEmailConsent:consent()},now),true);
  assert.equal(staleUnconvertedProspectEligible({id:'inside',stage:'lost',updatedAt:cutoff+1,marketingEmailConsent:consent()},now),false);
});

test('de-identification strips direct identifiers and operational follow-up state while preserving aggregate-safe funnel fields',()=>{
  const before={
    id:'p1',name:'Person',business:'Business',email:'person@example.test',phone:'5095550101',message:'private',
    visitorId:'visitor',sessionId:'session',workspaceId:'workspace',stripeCustomerId:'cus',stripeSubscriptionId:'sub',
    owner:'Rep',notes:'private notes',nextFollowUpAt:100,lastContactAt:90,lastRepliedAt:80,tags:['vip'],updatedBy:'admin@example.test',marketingEmailConsent:consent('granted'),
    industry:'Plumbing',category:'Home services',plan:'Growth',source:'google',stage:'converted',
    utmSource:'google',utmMedium:'cpc',utmCampaign:'fall',firstSource:'google',firstUtmSource:'google',
    firstUtmMedium:'cpc',firstUtmCampaign:'fall',campaign:'Fall PPC',convertedAt:70,monthlyValue:399,setupValue:500,createdAt:10,updatedAt:20
  };
  const after=deidentifyProspectForAnalytics(before,1000);
  for(const field of ['name','business','email','phone','message','visitorId','sessionId','workspaceId','stripeCustomerId','stripeSubscriptionId','owner','notes','nextFollowUpAt','lastContactAt','lastRepliedAt','tags','updatedBy','marketingEmailConsent'])
    assert.equal(Object.prototype.hasOwnProperty.call(after,field),false,field);
  assert.equal(after.id,'p1');assert.equal(after.stage,'converted');assert.equal(after.plan,'Growth');assert.equal(after.source,'google');
  assert.equal(after.monthlyValue,399);assert.equal(after.setupValue,500);assert.equal(after.privacyState,'deidentified');assert.equal(after.deidentifiedAt,1000);
});

test('retention planning is bounded, deterministic and honors explicit consent ids',()=>{
  const now=800*day,old=now-400*day;
  const records=[
    {id:'a',stage:'new',updatedAt:old,marketingEmailConsent:consent()},
    {id:'b',stage:'lost',updatedAt:old,marketingEmailConsent:consent()},
    {id:'c',stage:'qualified',updatedAt:old,marketingEmailConsent:consent()},
    {id:'recent',stage:'new',updatedAt:now-10*day,marketingEmailConsent:consent()}
  ];
  const plan=planStaleProspectDeidentification(records,now,{limit:1,consentIds:['b']});
  assert.equal(plan.scanned,4);assert.equal(plan.eligible,2);assert.equal(plan.planned.length,1);assert.equal(plan.planned[0].id,'a');assert.equal(plan.hasMore,true);
  assert.equal(plan.consentActiveCount,1);assert.equal(plan.consentInactiveVerifiedCount,3);assert.equal(plan.consentUnknownCount,0);
  assert.equal(plan.planned[0].after.privacyState,'deidentified');
});

test('retention planning fails closed on duplicate, malformed, over-capacity or invalid batch inputs',()=>{
  const now=800*day;
  assert.throws(()=>planStaleProspectDeidentification([{id:'x',updatedAt:1},{id:'x',updatedAt:1}],now),/duplicate ids/);
  assert.throws(()=>planStaleProspectDeidentification([{updatedAt:1}],now),/malformed/);
  assert.throws(()=>planStaleProspectDeidentification(Array.from({length:2001},(_,i)=>({id:String(i),updatedAt:1})),now),/exceeds capacity/);
  assert.throws(()=>planStaleProspectDeidentification([{id:'x',updatedAt:1}],now,{limit:0}),/batch limit/);
});


test('unknown historical consent evidence is counted and blocks automatic retention eligibility',()=>{
  const now=900*day,old=now-400*day,records=[
    {id:'legacy',stage:'new',updatedAt:old},
    {id:'ready',stage:'new',updatedAt:old,marketingEmailConsent:consent()},
    {id:'active',stage:'new',updatedAt:old,marketingEmailConsent:consent('granted')}
  ];
  const plan=planStaleProspectDeidentification(records,now,{limit:10});
  assert.equal(plan.eligible,1);
  assert.equal(plan.planned[0].id,'ready');
  assert.equal(plan.consentUnknownCount,1);
  assert.equal(plan.consentInactiveVerifiedCount,1);
  assert.equal(plan.consentActiveCount,1);
});
