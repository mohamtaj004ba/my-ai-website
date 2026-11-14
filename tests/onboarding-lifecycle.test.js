const test=require('node:test');
const assert=require('node:assert/strict');
const {ONBOARDING_STAGES,deriveOnboardingStage,canManuallyMarkLive}=require('../lib/onboarding-stage');

test('CallerCore internal onboarding lifecycle has the complete managed stage order',()=>{
  assert.deepEqual(ONBOARDING_STAGES,['Paid','Review','Intake','Building','QA','Client Test','Ready','Live']);
});

test('onboarding lifecycle derives each managed stage from verified state',()=>{
  const cases=[
    ['Paid',{},{}],
    ['Review',{status:'awaiting_review'},{}],
    ['Intake',{status:'awaiting_agreement'},{onboardingSent:true,intake:false}],
    ['Building',{status:'building_review'},{intake:true,adminReview:false}],
    ['QA',{status:'qa_complete'},{adminReview:true,testCall:false}],
    ['Client Test',{status:'client_test'},{testCall:true,clientApproval:false}],
    ['Ready',{status:'ready'},{clientApproval:true,live:false}],
    ['Live',{status:'live'},{live:true}]
  ];
  for(const [expected,onboarding,checklist] of cases){
    assert.equal(deriveOnboardingStage(onboarding,checklist),expected,expected);
  }
});

test('checklist progression derives stages even when status lags',()=>{
  assert.equal(deriveOnboardingStage({status:'paid'},{onboardingSent:true,intake:false}),'Intake');
  assert.equal(deriveOnboardingStage({status:'paid'},{intake:true,adminReview:false}),'Building');
  assert.equal(deriveOnboardingStage({status:'paid'},{adminReview:true,testCall:false}),'QA');
  assert.equal(deriveOnboardingStage({status:'paid'},{testCall:true,clientApproval:false}),'Client Test');
  assert.equal(deriveOnboardingStage({status:'paid'},{clientApproval:true,live:false}),'Ready');
  assert.equal(deriveOnboardingStage({status:'paid'},{live:true}),'Live');
});

test('manual Live label cannot bypass verified launch state',()=>{
  assert.equal(canManuallyMarkLive({workspace:{status:'active'},onboarding:{status:'live',checklist:{live:true}}}),true);
  assert.equal(canManuallyMarkLive({workspace:{status:'active'},onboarding:{status:'ready',checklist:{live:true}}}),false);
  assert.equal(canManuallyMarkLive({workspace:{status:'active'},onboarding:{status:'live',checklist:{live:false}}}),false);
  assert.equal(canManuallyMarkLive({workspace:{status:'suspended'},onboarding:{status:'live',checklist:{live:true}}}),false);
});
