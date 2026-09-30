const {marketingEmailConsentState}=require('./prospect-consent');

const STALE_UNCONVERTED_PROSPECT_MS=365*24*60*60*1000;

function requireProspect(prospect){
  if(!prospect||typeof prospect!=='object'||Array.isArray(prospect)||!String(prospect.id||'').trim())throw new Error('Prospect record is malformed');
  return prospect;
}

function prospectLastMeaningfulAt(prospect){
  requireProspect(prospect);
  const timestamps=[prospect.createdAt,prospect.updatedAt,prospect.lastContactAt,prospect.lastRepliedAt]
    .map(Number).filter(value=>Number.isFinite(value)&&value>0);
  return timestamps.length?Math.max(...timestamps):0;
}

function prospectHasCustomerRelationship(prospect){
  requireProspect(prospect);
  return prospect.stage==='converted'||!!String(prospect.workspaceId||'').trim()||!!String(prospect.stripeCustomerId||'').trim()||!!String(prospect.stripeSubscriptionId||'').trim();
}

function deidentifyProspectForAnalytics(prospect,now=Date.now()){
  requireProspect(prospect);
  const at=Number(now);
  if(!Number.isFinite(at)||at<=0)throw new Error('De-identification time is invalid');
  return {
    id:String(prospect.id),
    industry:String(prospect.industry||'').slice(0,160),
    category:String(prospect.category||'').slice(0,100),
    plan:String(prospect.plan||'').slice(0,30),
    source:String(prospect.source||'').slice(0,80),
    stage:String(prospect.stage||'').slice(0,60),
    utmSource:String(prospect.utmSource||'').slice(0,120),
    utmMedium:String(prospect.utmMedium||'').slice(0,120),
    utmCampaign:String(prospect.utmCampaign||'').slice(0,160),
    firstSource:String(prospect.firstSource||'').slice(0,80),
    firstUtmSource:String(prospect.firstUtmSource||'').slice(0,120),
    firstUtmMedium:String(prospect.firstUtmMedium||'').slice(0,120),
    firstUtmCampaign:String(prospect.firstUtmCampaign||'').slice(0,160),
    campaign:String(prospect.campaign||'').slice(0,160),
    convertedAt:Number(prospect.convertedAt||0)||null,
    monthlyValue:Number(prospect.monthlyValue||0)||0,
    setupValue:Number(prospect.setupValue||0)||0,
    createdAt:Number(prospect.createdAt||0)||null,
    updatedAt:Math.max(at,Number(prospect.updatedAt||prospect.createdAt||0)+1),
    deidentifiedAt:at,
    privacyState:'deidentified'
  };
}

function staleUnconvertedProspectEligible(prospect,now=Date.now(),{consentActive=false}={}){
  requireProspect(prospect);
  const at=Number(now);
  if(!Number.isFinite(at)||at<=0)throw new Error('Retention evaluation time is invalid');
  const consent=marketingEmailConsentState(prospect);
  if(prospect.privacyState==='deidentified'||consentActive||consent.active||prospectHasCustomerRelationship(prospect))return false;
  // Automatic de-identification must not guess about historical or imported consent.
  // Only records with verified explicit evidence that marketing consent is not active
  // can become executor-eligible.
  if(!consent.verified)return false;
  const last=prospectLastMeaningfulAt(prospect);
  return last>0&&last<=at-STALE_UNCONVERTED_PROSPECT_MS;
}

function planStaleProspectDeidentification(records,now=Date.now(),{limit=25,consentIds=[]}={}){
  if(!Array.isArray(records)||records.length>2000)throw new Error('Prospect retention input is invalid or exceeds capacity');
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Prospect retention batch limit is invalid');
  const seen=new Set(),consent=new Set((Array.isArray(consentIds)?consentIds:[]).map(String)),eligible=[];
  let consentActiveCount=0,consentInactiveVerifiedCount=0,consentUnknownCount=0;
  for(const prospect of records){
    requireProspect(prospect);
    const id=String(prospect.id);
    if(seen.has(id))throw new Error('Prospect retention input contains duplicate ids');
    seen.add(id);
    const state=marketingEmailConsentState(prospect),externalActive=consent.has(id);
    if(state.active||externalActive)consentActiveCount++;
    else if(state.verified)consentInactiveVerifiedCount++;
    else consentUnknownCount++;
    if(staleUnconvertedProspectEligible(prospect,now,{consentActive:externalActive}))eligible.push(prospect);
  }
  return {
    scanned:records.length,
    eligible:eligible.length,
    consentActiveCount,consentInactiveVerifiedCount,consentUnknownCount,
    planned:eligible.slice(0,limit).map(prospect=>({id:String(prospect.id),before:prospect,after:deidentifyProspectForAnalytics(prospect,now)})),
    hasMore:eligible.length>limit
  };
}

module.exports={STALE_UNCONVERTED_PROSPECT_MS,prospectLastMeaningfulAt,prospectHasCustomerRelationship,deidentifyProspectForAnalytics,staleUnconvertedProspectEligible,planStaleProspectDeidentification};
