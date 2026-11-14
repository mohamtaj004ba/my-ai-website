const MARKETING_EMAIL_CONSENT_VERSION='2026-09-29';
const MARKETING_EMAIL_SOURCES=new Set(['contact_form','get_started']);

function validAt(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:0}
function validEvidence(value){
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&
    ['granted','not_granted','revoked'].includes(String(value.status||''))&&
    MARKETING_EMAIL_SOURCES.has(String(value.source||''))&&
    String(value.noticeVersion||'')===MARKETING_EMAIL_CONSENT_VERSION&&
    !!validAt(value.recordedAt)&&
    (String(value.status||'')!=='revoked'||(!!validAt(value.revokedAt)&&String(value.revocationSource||'')==='unsubscribe_link'));
}
function normalizeExisting(value){
  if(value==null)return null;
  return validEvidence(value)?{
    status:String(value.status),source:String(value.source),noticeVersion:MARKETING_EMAIL_CONSENT_VERSION,
    recordedAt:validAt(value.recordedAt),
    ...(String(value.status)==='revoked'?{revokedAt:validAt(value.revokedAt),revocationSource:'unsubscribe_link'}:{})
  }:null;
}
function mergeMarketingEmailConsent(existing,input,{now=Date.now(),existingProspect=false}={}){
  const current=normalizeExisting(existing);
  if(input==null)return current||existing||null;
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Marketing consent evidence is invalid');
  const source=String(input.source||''),granted=input.granted;
  if(!MARKETING_EMAIL_SOURCES.has(source)||typeof granted!=='boolean')throw new Error('Marketing consent evidence is invalid');
  const recordedAt=validAt(now);if(!recordedAt)throw new Error('Marketing consent time is invalid');
  if(granted===true)return {status:'granted',source,noticeVersion:MARKETING_EMAIL_CONSENT_VERSION,recordedAt};
  // An unchecked optional box is evidence only that this submission did not grant consent.
  // It is not an unsubscribe action and must never revoke an earlier explicit grant.
  if(current?.status==='granted'||current?.status==='revoked')return current;
  // For an existing record with no trustworthy evidence, an unchecked new form
  // cannot prove that an older consent event never happened elsewhere.
  if(existingProspect&&!current)return existing||null;
  return {status:'not_granted',source,noticeVersion:MARKETING_EMAIL_CONSENT_VERSION,recordedAt};
}
function marketingEmailConsentActive(prospect){
  const evidence=normalizeExisting(prospect?.marketingEmailConsent);
  return evidence?.status==='granted';
}
function marketingEmailConsentState(prospect){
  const evidence=normalizeExisting(prospect?.marketingEmailConsent);
  if(!evidence)return {state:'unknown',active:false,verified:false};
  return {state:evidence.status,active:evidence.status==='granted',verified:true,source:evidence.source,recordedAt:evidence.recordedAt,
    noticeVersion:evidence.noticeVersion,...(evidence.status==='revoked'?{revokedAt:evidence.revokedAt,revocationSource:evidence.revocationSource}:{})};
}

function revokeMarketingEmailConsent(existing,{now=Date.now()}={}){
  const current=normalizeExisting(existing),revokedAt=validAt(now);
  if(!revokedAt)throw new Error('Marketing consent revocation time is invalid');
  if(!current||!['granted','revoked'].includes(current.status))throw new Error('Active marketing consent evidence is required');
  if(current.status==='revoked')return current;
  return {...current,status:'revoked',revokedAt,revocationSource:'unsubscribe_link'};
}

module.exports={MARKETING_EMAIL_CONSENT_VERSION,MARKETING_EMAIL_SOURCES,validEvidence,mergeMarketingEmailConsent,revokeMarketingEmailConsent,marketingEmailConsentActive,marketingEmailConsentState};
