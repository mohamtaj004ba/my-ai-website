const test=require('node:test');const assert=require('node:assert/strict');
const {PLANS,normalizePlan,entitlementsFor}=require('../lib/plans');
test('pricing contract remains stable',()=>{
  assert.deepEqual({Starter:PLANS.Starter.price,Growth:PLANS.Growth.price,Pro:PLANS.Pro.price},{Starter:349,Growth:599,Pro:999});
  assert.equal(PLANS.Starter.minutes,300);assert.equal(PLANS.Growth.minutes,600);assert.equal(PLANS.Pro.minutes,null);
  assert.equal(PLANS.Starter.locations,1);assert.equal(PLANS.Growth.locations,2);assert.equal(PLANS.Pro.locations,5);
});
test('unknown plans fail closed to Starter',()=>assert.equal(normalizePlan('Enterprise'),'Starter'));
test('Growth and Pro entitlement differences remain enforced',()=>{
  assert.equal(entitlementsFor('Growth').features.apiAccess,false);
  assert.equal(entitlementsFor('Pro').features.apiAccess,true);
  assert.equal(entitlementsFor('Starter').features.unifiedInbox,false);
});

test('runtime capabilities default deferred integrations off',()=>{
  const oldCal=process.env.CALLERCORE_CALENDAR_ENABLED,oldSms=process.env.CALLERCORE_SMS_ENABLED;
  delete process.env.CALLERCORE_CALENDAR_ENABLED;delete process.env.CALLERCORE_SMS_ENABLED;
  delete require.cache[require.resolve('../lib/plans')];
  const {entitlementsFor}=require('../lib/plans');
  const growth=entitlementsFor('Growth');
  assert.equal(growth.features.appointments,false);
  assert.equal(growth.features.sms,false);
  if(oldCal===undefined)delete process.env.CALLERCORE_CALENDAR_ENABLED;else process.env.CALLERCORE_CALENDAR_ENABLED=oldCal;
  if(oldSms===undefined)delete process.env.CALLERCORE_SMS_ENABLED;else process.env.CALLERCORE_SMS_ENABLED=oldSms;
});
