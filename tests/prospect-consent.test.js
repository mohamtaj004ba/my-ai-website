const test=require('node:test');
const assert=require('node:assert/strict');
const {
  MARKETING_EMAIL_CONSENT_VERSION,validEvidence,mergeMarketingEmailConsent,marketingEmailConsentActive,marketingEmailConsentState
}=require('../lib/prospect-consent');

test('explicit checked opt-in records verifiable email-marketing consent evidence',()=>{
  const evidence=mergeMarketingEmailConsent(null,{granted:true,source:'contact_form'},{now:1234});
  assert.deepEqual(evidence,{status:'granted',source:'contact_form',noticeVersion:MARKETING_EMAIL_CONSENT_VERSION,recordedAt:1234});
  assert.equal(validEvidence(evidence),true);
  assert.equal(marketingEmailConsentActive({marketingEmailConsent:evidence}),true);
  assert.deepEqual(marketingEmailConsentState({marketingEmailConsent:evidence}),{
    state:'granted',active:true,verified:true,source:'contact_form',recordedAt:1234,noticeVersion:MARKETING_EMAIL_CONSENT_VERSION
  });
});

test('unchecked optional box records not-granted evidence but never revokes an earlier grant',()=>{
  const absent=mergeMarketingEmailConsent(null,{granted:false,source:'get_started'},{now:2000});
  assert.equal(absent.status,'not_granted');
  assert.equal(marketingEmailConsentActive({marketingEmailConsent:absent}),false);
  const granted=mergeMarketingEmailConsent(null,{granted:true,source:'contact_form'},{now:1000});
  const laterUnchecked=mergeMarketingEmailConsent(granted,{granted:false,source:'get_started'},{now:3000});
  assert.deepEqual(laterUnchecked,granted);
});

test('missing input preserves existing evidence and missing historical evidence stays unknown',()=>{
  const granted=mergeMarketingEmailConsent(null,{granted:true,source:'contact_form'},{now:1000});
  assert.deepEqual(mergeMarketingEmailConsent(granted,null,{now:2000}),granted);
  assert.deepEqual(marketingEmailConsentState({}),{state:'unknown',active:false,verified:false});
});

test('forged sources, malformed values, missing timestamps and old notice shapes are not trusted',()=>{
  assert.throws(()=>mergeMarketingEmailConsent(null,{granted:true,source:'chatbot'},{now:1000}),/invalid/);
  assert.throws(()=>mergeMarketingEmailConsent(null,{granted:'true',source:'contact_form'},{now:1000}),/invalid/);
  assert.equal(validEvidence({status:'granted',source:'contact_form',noticeVersion:'old',recordedAt:1000}),false);
  assert.equal(validEvidence({status:'granted',source:'contact_form',noticeVersion:MARKETING_EMAIL_CONSENT_VERSION,recordedAt:0}),false);
  assert.deepEqual(marketingEmailConsentState({marketingEmailConsent:{status:'granted',source:'contact_form',noticeVersion:'old',recordedAt:1000}}),{
    state:'unknown',active:false,verified:false
  });
});


test('unchecked form cannot convert unknown historical consent into verified not-granted evidence',()=>{
  assert.equal(mergeMarketingEmailConsent(null,{granted:false,source:'contact_form'},{now:4000,existingProspect:true}),null);
  const malformed={status:'granted',source:'legacy_import',noticeVersion:'old',recordedAt:1000};
  assert.deepEqual(mergeMarketingEmailConsent(malformed,{granted:false,source:'get_started'},{now:5000,existingProspect:true}),malformed);
  const explicit=mergeMarketingEmailConsent(null,{granted:true,source:'get_started'},{now:6000,existingProspect:true});
  assert.equal(explicit.status,'granted');
});
