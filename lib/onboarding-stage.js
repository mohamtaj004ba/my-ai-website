const ONBOARDING_STAGES=Object.freeze(['Paid','Review','Intake','Building','QA','Client Test','Ready','Live']);

function deriveOnboardingStage(onboarding={},checklist={}){
  let stage='Paid';
  if(onboarding?.status==='awaiting_review')stage='Review';
  else if(
    ['awaiting_agreement','intake_in_progress'].includes(onboarding?.status)||
    (checklist.onboardingSent&&!checklist.intake)
  )stage='Intake';
  else if(onboarding?.status==='building_review'||(checklist.intake&&!checklist.adminReview))stage='Building';
  else if(onboarding?.status==='qa_complete'||(checklist.adminReview&&!checklist.testCall))stage='QA';
  else if(onboarding?.status==='client_test'||(checklist.testCall&&!checklist.clientApproval))stage='Client Test';
  else if(onboarding?.status==='ready'||(checklist.clientApproval&&!checklist.live))stage='Ready';
  if(checklist.live||onboarding?.status==='live')stage='Live';
  return stage;
}

function canManuallyMarkLive({workspace,onboarding}={}){
  return !!workspace&&workspace.status==='active'&&onboarding?.status==='live'&&onboarding?.checklist?.live===true;
}

module.exports={ONBOARDING_STAGES,deriveOnboardingStage,canManuallyMarkLive};
