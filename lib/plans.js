const PLANS={
  Starter:{price:349,minutes:300,locations:1,features:{appointments:false,automations:false,advancedAnalytics:false,apiAccess:false,unifiedInbox:false}},
  Growth:{price:599,minutes:600,locations:2,features:{appointments:true,automations:true,advancedAnalytics:true,apiAccess:false,unifiedInbox:true}},
  Pro:{price:999,minutes:null,locations:5,features:{appointments:true,automations:true,advancedAnalytics:true,apiAccess:true,unifiedInbox:true}}
};
function normalizePlan(plan){return PLANS[plan]?plan:'Starter'}
function runtimeCapabilities(){
  return {
    calendar:process.env.CALLERCORE_CALENDAR_ENABLED==='true',
    sms:process.env.CALLERCORE_SMS_ENABLED==='true'
  };
}
function entitlementsFor(plan){
  const key=normalizePlan(plan),base=PLANS[key],capabilities=runtimeCapabilities();
  return {
    plan:key,price:base.price,minutes:base.minutes,locations:base.locations,
    capabilities,
    features:{
      ...base.features,
      appointments:!!base.features.appointments&&capabilities.calendar,
      sms:capabilities.sms
    }
  };
}
module.exports={PLANS,normalizePlan,runtimeCapabilities,entitlementsFor};