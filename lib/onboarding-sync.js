const https=require('https');
const {kv}=require('@vercel/kv');

function clean(v,n=1000){return String(v||'').trim().slice(0,n)}
function parseAddress(raw=''){
  const value=clean(raw,300),parts=value.split(',').map(x=>x.trim()).filter(Boolean);
  let streetAddress=value,city='',state='',postalCode='';
  if(parts.length>=3){
    streetAddress=parts.slice(0,-2).join(', ');
    city=parts[parts.length-2];
    const tail=parts[parts.length-1],m=tail.match(/^([A-Za-z]{2,30})(?:\s+(\d{5}(?:-\d{4})?))?$/);
    if(m){state=m[1];postalCode=m[2]||''}else state=tail;
  }else{
    const m=value.match(/^(.*?),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if(m){streetAddress=m[1];city=m[2];state=m[3];postalCode=m[4]}
  }
  return {streetAddress,city,state,postalCode};
}
function normalizeTone(v=''){
  const x=clean(v,80).toLowerCase();
  if(x.includes('casual'))return 'Friendly & casual';
  if(x.includes('straightforward')||x.includes('efficient'))return 'Straightforward & efficient';
  if(x.includes('formal')||x.includes('polished'))return 'Formal & polished';
  return 'Warm & professional';
}
function defaultQuestions(i){
  const questions=['What can we help you with today?','What city or ZIP code is the service needed in?','How urgent is this?'];
  if(i.tradeType)questions.push('Is this for '+clean(i.tradeType,80).toLowerCase()+' service, repair, or an estimate?');
  if(i.industry==='Automotive'||i.collectVehicleInfo==='Yes')questions.push('What is the vehicle year, make, and model?');
  if(i.industry==='Veterinary'&&String(i.vetAskSpecies||'').startsWith('Yes'))questions.push('What type of animal is this, and what is the pet’s name?');
  if(i.industry==='Real Estate')questions.push('Which property or listing are you calling about?');
  return [...new Set(questions)].slice(0,12);
}
function buildEmergencyInstructions(i){
  const bits=[];
  if(i.exampleEmergency)bits.push('Treat this as an emergency example: '+clean(i.exampleEmergency,500)+'.');
  if(i.promiseEmergency)bits.push('Human follow-up target: '+clean(i.promiseEmergency,120)+'.');
  if(i.escalationName||i.escalationPhone)bits.push('Escalate emergencies to '+[clean(i.escalationName,120),clean(i.escalationPhone,40)].filter(Boolean).join(' at ')+'.');
  if(i.escalationBackupName||i.escalationBackupPhone)bits.push('Backup: '+[clean(i.escalationBackupName,120),clean(i.escalationBackupPhone,40)].filter(Boolean).join(' at ')+'.');
  if(i.gasUtility)bits.push('For a reported gas smell, instruct the caller to leave the building and call '+clean(i.gasUtility,120)+' or 911 before anything else.');
  return bits.join(' ');
}
function buildKnowledge(i){
  return {
    servicesOffered:clean(i.servicesOffered,5000),
    servicesNotOffered:clean(i.servicesNotOffered,5000),
    faqs:clean(i.faqs,6000),
    pricingPolicy:clean(i.pricingPolicy,160),
    pricingRanges:clean(i.pricingRanges,3000),
    guardrails:clean(i.guardrails,4000),
    additionalNotes:clean(i.additionalNotes,5000),
    outOfArea:clean(i.outOfArea,500),
    outOfAreaReferral:clean(i.outOfAreaReferral,500),
    routineExample:clean(i.exampleRoutine,500),
    routinePromise:clean(i.promiseRoutine,120),
    urgentExample:clean(i.exampleUrgent,500),
    urgentPromise:clean(i.promiseUrgent,120),
    emergencyExample:clean(i.exampleEmergency,500),
    emergencyPromise:clean(i.promiseEmergency,120)
  };
}
async function llmAgentDraft(i,workspace,base){
  if(!process.env.ANTHROPIC_API_KEY)return base;
  const payload={
    businessName:workspace.name||i.businessName||'',
    industry:i.industryOther||i.industry||workspace.industry||'',
    serviceArea:i.serviceArea||'',
    services:i.servicesOffered||'',
    servicesNotOffered:i.servicesNotOffered||'',
    hours:i.hours||'',
    greeting:i.greeting||'',
    tone:i.tone||'',
    faqs:i.faqs||'',
    pricingPolicy:i.pricingPolicy||'',
    pricingRanges:i.pricingRanges||'',
    guardrails:i.guardrails||'',
    routine:{example:i.exampleRoutine||'',followup:i.promiseRoutine||''},
    urgent:{example:i.exampleUrgent||'',followup:i.promiseUrgent||''},
    emergency:{example:i.exampleEmergency||'',followup:i.promiseEmergency||''},
    callHandling:i.callHandling||''
  };
  const system='You create a conservative first-draft configuration for an AI receptionist. Use ONLY facts in the supplied onboarding JSON. Do not invent services, prices, hours, policies, guarantees, or emergency procedures. Return raw JSON only with keys openingMessage, tone, qualificationQuestions (array, max 8), serviceArea, businessHours, emergencyInstructions. Keep openingMessage under 220 characters and natural. If a value is not supported, use the supplied fallback or an empty value.';
  const body=JSON.stringify({model:'claude-sonnet-4-6',max_tokens:900,system,messages:[{role:'user',content:JSON.stringify(payload)}]});
  const options={hostname:'api.anthropic.com',path:'/v1/messages',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'}};
  try{
    const raw=await new Promise((resolve,reject)=>{
      const req=https.request(options,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>res.statusCode===200?resolve(d):reject(new Error('agent_draft_'+res.statusCode)))});
      req.on('error',reject);req.setTimeout(9000,()=>req.destroy(new Error('agent_draft_timeout')));req.write(body);req.end();
    });
    const parsed=JSON.parse(raw),txt=String(parsed.content?.[0]?.text||'').trim().replace(/^\x60\x60\x60json/i,'').replace(/^\x60\x60\x60/,'').replace(/\x60\x60\x60$/,'').trim(),draft=JSON.parse(txt);
    return {
      ...base,
      openingMessage:clean(draft.openingMessage,1200)||base.openingMessage,
      tone:clean(draft.tone,80)||base.tone,
      serviceArea:clean(draft.serviceArea,500)||base.serviceArea,
      businessHours:clean(draft.businessHours,500)||base.businessHours,
      emergencyInstructions:clean(draft.emergencyInstructions,1200)||base.emergencyInstructions,
      qualificationQuestions:Array.isArray(draft.qualificationQuestions)?draft.qualificationQuestions.map(x=>clean(x,240)).filter(Boolean).slice(0,8):base.qualificationQuestions,
      generatedBy:'smart_onboarding'
    };
  }catch(err){console.error('Smart onboarding agent draft fallback:',err.message);return base}
}
async function syncCompletedOnboarding(record){
  const id=clean(record.workspaceId,100);if(!id)throw new Error('workspace_missing');
  const wsKey='workspace:'+id,workspace=await kv.get(wsKey);if(!workspace)throw new Error('workspace_missing');
  const i=record.intake||{},platform=await kv.get('platform:settings')||{},now=Date.now(),address=parseAddress(i.address);
  const existingSettings=await kv.get('settings:'+id)||{};
  const settings={
    ...existingSettings,
    businessName:clean(i.businessName,160)||workspace.name||'',
    primaryEmail:clean(i.email,200).toLowerCase()||workspace.ownerEmail||'',
    contactName:clean(i.contactName,160)||workspace.ownerName||'',
    businessPhone:clean(i.phone,40)||workspace.phone||'',
    website:clean(i.website||record.website,300),
    streetAddress:address.streetAddress||existingSettings.streetAddress||'',
    city:address.city||existingSettings.city||'',
    state:address.state||existingSettings.state||'',
    postalCode:address.postalCode||existingSettings.postalCode||'',
    industry:clean(i.industryOther||i.industry,120)||workspace.industry||'',
    serviceArea:clean(i.serviceArea,500),
    timezone:existingSettings.timezone||platform.defaultTimezone||'America/Los_Angeles',
    notificationEmail:clean(i.notifyOtherEmail||i.email,200).toLowerCase()||workspace.ownerEmail||'',
    smsAlerts:/text|both/i.test(String(i.notificationPreference||'')),
    emailAlerts:/email|both/i.test(String(i.notificationPreference||'')),
    updatedAt:now,
    source:'smart_onboarding'
  };
  await kv.set('settings:'+id,settings);

  const businessName=settings.businessName||workspace.name||'our business';
  const baseAgent={
    name:platform.defaultAgentName||'Maya',
    role:'AI Receptionist',
    openingMessage:clean(i.greeting,1200)||('Thanks for calling '+businessName+'. How can I help you today?'),
    tone:normalizeTone(i.tone),
    serviceArea:clean(i.serviceArea,500),
    businessHours:clean(i.hours,500),
    emergencyInstructions:buildEmergencyInstructions(i),
    qualificationQuestions:defaultQuestions(i),
    transferNumber:clean(i.escalationPhone,40),
    knowledge:buildKnowledge(i),
    callHandling:clean(i.callHandling,500),
    addressSharing:clean(i.addressSharing,300),
    source:'smart_onboarding',
    draftStatus:'needs_admin_review',
    updatedAt:now
  };
  const generated=await llmAgentDraft(i,workspace,baseAgent);
  generated.knowledge=baseAgent.knowledge;generated.callHandling=baseAgent.callHandling;generated.addressSharing=baseAgent.addressSharing;generated.source='smart_onboarding';generated.draftStatus='needs_admin_review';generated.updatedAt=now;
  await kv.set('agent:'+id,generated);

  const existingLocations=await kv.get('locations:'+id)||[];
  if(!Array.isArray(existingLocations)||!existingLocations.length){
    await kv.set('locations:'+id,[{id:'primary',name:'Primary location',phone:settings.businessPhone,address:clean(i.address,300),timezone:settings.timezone,active:true,updatedAt:now,source:'smart_onboarding'}]);
  }

  const routing={
    workspaceId:id,
    routingChoice:clean(i.routingChoice,120),
    forwardingFrom:clean(i.forwardNumber,40),
    phoneCarrier:clean(i.phoneCarrier,120),
    callHandling:clean(i.callHandling,500),
    transferNumber:clean(i.escalationPhone,40),
    backupTransferNumber:clean(i.escalationBackupPhone,40),
    notificationPreference:clean(i.notificationPreference,120),
    notifyRecipient:clean(i.notifyRecipient,160),
    requestedAt:now,
    status:'captured'
  };
  await kv.set('routing-request:'+id,routing);

  const nextWorkspace={
    ...workspace,name:settings.businessName||workspace.name,ownerName:settings.contactName||workspace.ownerName,
    ownerEmail:settings.primaryEmail||workspace.ownerEmail,industry:settings.industry||workspace.industry,
    status:workspace.status==='suspended'?'suspended':'onboarding',updatedAt:now
  };
  await kv.set(wsKey,nextWorkspace);

  const onboardingState={
    workspaceId:id,status:'intake_complete',completionPercent:100,intakeCompletedAt:record.intakeCompletedAt||now,
    website:settings.website||'',websiteScan:record.websiteScan||null,
    checklist:{
      payment:true,agreement:!!record.agreementSigned,intake:true,businessProfile:true,agentDraft:true,
      routingCaptured:!!routing.routingChoice,phoneAssigned:!!String(nextWorkspace.phone||'').trim(),
      adminReview:false,testCall:false,clientApproval:false,live:false
    },
    updatedAt:now
  };
  await kv.set('onboarding:workspace:'+id,onboardingState);
  return {settings,agent:generated,routing,onboarding:onboardingState,workspace:nextWorkspace};
}
module.exports={syncCompletedOnboarding,parseAddress};
