const {buildVoiceExport,validateVoiceExport}=require('./voice-export');
const DAY=86400000;
function monthsBefore(now,months){
  const d=new Date(now),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-months);
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.getTime();
}
// A content inventory for review, never a deletion authorization or provider
// retention claim. Journals and usage remain intact even for old transcripts.
function summarize(bundle,workspaceId,{now=Date.now()}={}){
  validateVoiceExport(bundle,workspaceId);
  if(!Number.isFinite(now)||now<0)throw new Error('Retention review time unavailable');
  const counts={calls:bundle.calls.length,transcriptReview:0,recordingReview:0,metadataReview:0,unknownDates:0,activeCalls:0,contacts:bundle.contacts.length,pendingDetails:Object.keys(bundle.pending).length};
  for(const call of bundle.calls){
    if(call.status!=='ended'){counts.activeCalls++;continue}
    const raw=call.endedAt??call.startedAt,at=typeof raw==='number'?raw:typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(raw)?Date.parse(raw):NaN;
    if(!Number.isFinite(at)||at<0||at>now){counts.unknownDates++;continue}
    if(at<=now-180*DAY&&(call.transcript?.length||call.summary))counts.transcriptReview++;
    if(at<=now-90*DAY&&call.recordingAvailable===true)counts.recordingReview++;
    if(at<=monthsBefore(now,24))counts.metadataReview++;
  }
  return {checkedAt:now,mode:'review_only',deletionEnabled:false,providerRetentionVerified:false,holdReviewRequired:true,
    policy:{transcriptDays:180,recordingDays:90,metadataMonths:24},counts};
}
async function review(kv,workspaceId,options){
  const before=await kv.get('workspace:'+workspaceId);
  if(!before?.voiceTestWorkspace||before.id!==workspaceId||before.stripeCustomerId||before.stripeSubscriptionId||before.deletedAt||before.status==='deleted')throw new Error('Isolated voice workspace required');
  const calls=await kv.get('calls:'+workspaceId);
  if(calls!=null&&!Array.isArray(calls))throw new Error('Call history unavailable');
  const bundle=await buildVoiceExport(kv,workspaceId,calls||[]);
  const [after,latest]=await Promise.all([kv.get('workspace:'+workspaceId),kv.get('calls:'+workspaceId)]);
  if(JSON.stringify(before)!==JSON.stringify(after)||JSON.stringify(calls)!==JSON.stringify(latest))throw new Error('Workspace changed during review');
  return summarize(bundle,workspaceId,options);
}
module.exports={review,summarize,monthsBefore};
