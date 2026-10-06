const {E164}=require('./voice-policy');
// Public number disclosure is a separate gate from a configured test assistant.
// These are operator-reviewed real-call evidence records, never seed fixtures.
async function demoReadiness(kv,env=process.env){
  if(env.VERCEL_ENV!=='preview'||env.CALLERCORE_VOICE_PREVIEW_ENABLED!=='true'||!env.CALLERCORE_DEMO_WORKSPACE_ID||!E164.test(env.DEMO_PHONE_NUMBER||''))return {available:false};
  const id=env.CALLERCORE_DEMO_WORKSPACE_ID;
  const [ws,config,evidence]=await Promise.all([kv.get('workspace:'+id),kv.get('voice:config:'+id),kv.get('voice:acceptance:'+id)]);
  if(!ws?.voiceTestWorkspace||!ws.demoVoiceWorkspace||ws.stripeCustomerId||ws.stripeSubscriptionId||ws.deletedAt||config?.purpose!=='demo'||config.state!=='ready'||!config.verifiedAt||Date.now()-config.verifiedAt>300000||config.numberId!==env.VAPI_DEMO_NUMBER_ID||config.assistantId!==env.VAPI_DEMO_ASSISTANT_ID)return {available:false};
  // Technical internal acceptance, demo calls, number-level anti-abuse controls
  // and disclosure/privacy review must each have independently recorded proof.
  if(!evidence||evidence.source!=='operator_real_call_review'||evidence.configRevision!==config.revision||!evidence.internalAcceptancePassed||!evidence.demoAcceptancePassed||!evidence.numberAbuseControlsVerified||!evidence.disclosureReviewed||!Array.isArray(evidence.callIds)||evidence.callIds.length<3)return {available:false};
  if(evidence.callIds.length>30||new Set(evidence.callIds).size!==evidence.callIds.length||evidence.callIds.some(id=>typeof id!=='string'||!/^voice_[a-f0-9]{24}$/.test(id)))return {available:false};
  for(const callId of evidence.callIds){
    const record=await kv.get('voice:call:'+callId);
    if(!record||record.workspaceId!==id||record.purpose!=='demo'||record.status!=='ended'||!record.durationVerified||record.transcriptState!=='available')return {available:false};
  }
  return {available:true,number:env.DEMO_PHONE_NUMBER,display:env.DEMO_PHONE_NUMBER_DISPLAY||env.DEMO_PHONE_NUMBER};
}
module.exports={demoReadiness};
