const PLANS={
  Starter:{price:349,minutes:300,locations:1,features:{appointments:false,automations:false,advancedAnalytics:false,apiAccess:false,unifiedInbox:false}},
  Growth:{price:599,minutes:600,locations:2,features:{appointments:true,automations:true,advancedAnalytics:true,apiAccess:false,unifiedInbox:true}},
  Pro:{price:999,minutes:null,locations:5,features:{appointments:true,automations:true,advancedAnalytics:true,apiAccess:true,unifiedInbox:true}}
};
function normalizePlan(plan){return PLANS[plan]?plan:'Starter'}
function entitlementsFor(plan){const key=normalizePlan(plan);return {plan:key,...PLANS[key]}}
module.exports={PLANS,normalizePlan,entitlementsFor};
