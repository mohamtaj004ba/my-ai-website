// Presentation classification only. Existing launch gates retain their own authority.
const VERIFIED_APPLICATION={sha:'713058a48d3c56e7701a6e7ca82bbf4f9ceb7d6a',run:'37551645588',url:'https://github.com/mohamtaj004ba/my-ai-website/actions/runs/37551645588'};
const CORE=new Set(['database','environment-scope','data-integrity','mailgun','onboarding-ai','gmail','gate-previewIsolation','application-e2e']);
const RELEASE=new Set(['checkout','stripe','gate-productionEnvScope','gate-supportEmail','billing-native','stripe-test-e2e']);
const OWNER=new Set(['gate-businessTax','gate-legalReview']);
const TECHNICAL=new Set(['voice','gate-voiceLifecycle']);
const healthy=x=>['operational','configured','confirmed'].includes(x.status);
function classifyReadiness(services,requiredForLaunch){
  const classified=services.map(x=>{
    const category=CORE.has(x.key)?'core':RELEASE.has(x.key)?'release':OWNER.has(x.key)?'owner':TECHNICAL.has(x.key)?'technical':'optional';
    const state=healthy(x)?'operational':category==='release'?(x.key==='checkout'?'launch-gated':'release-verification-required'):category==='owner'?'external-owner-action':category==='optional'?'optional':'blocked';
    return {...x,category,state};
  });
  const groups=Object.fromEntries(['core','technical','release','owner','optional'].map(category=>[category,classified.filter(x=>x.category===category)]));
  const blockers=classified.filter(x=>x.state==='blocked');
  const outstanding=category=>groups[category].filter(x=>!healthy(x)).length;
  const launchOutstanding=classified.filter(x=>requiredForLaunch.includes(x.key)&&!healthy(x));
  return {services:classified,readiness:{
    ready:launchOutstanding.length===0,requiredForLaunch,
    blockers:blockers.map(({key,name,detail})=>({key,name,detail})),
    launchOutstanding:launchOutstanding.map(({key,name,detail,state})=>({key,name,detail,state})),
    configured:classified.filter(healthy).length,total:classified.length,
    core:{healthy:groups.core.filter(healthy).length,total:groups.core.length},
    counts:{technicalBlockers:blockers.length,releaseSetup:outstanding('release'),ownerActions:outstanding('owner'),optionalSetup:outstanding('optional')}
  }};
}
module.exports={classifyReadiness,VERIFIED_APPLICATION};
