const {redact}=require('./voice-privacy');
// Administrator-only inspection of the isolated workspace. Return canonical
// product fields, never raw provider objects, credentials or transport IDs.
async function inspect(kv,id){
  const ws=await kv.get('workspace:'+id);
  if(!ws?.voiceTestWorkspace||ws.stripeCustomerId||ws.stripeSubscriptionId)return null;
  const [calls,leads,contacts,pending,state]=await Promise.all(['calls:','leads:','voice:contacts:','voice:pending:','followup:state:'].map(prefix=>kv.get(prefix+id)));
  if([calls,leads,contacts].some(value=>value!=null&&!Array.isArray(value))||pending!=null&&(typeof pending!=='object'||Array.isArray(pending)))throw new Error('Voice results unavailable');
  const real=(calls||[]).filter(call=>['phone','demo_phone'].includes(call?.source));
  const followups=require('./client-followup-snapshot').buildClientFollowupSnapshot(real.filter(call=>call.disposition!=='in_progress'),state||{});
  const fields=['id','caller','category','reason','outcome','disposition','createdAt','durationSeconds','summary','transcriptState','transferState','recordingState','contactId'];
  return {callCount:real.length,followupCount:followups.totals.pending,leadCount:(leads||[]).filter(lead=>['Phone call','Demo call'].includes(lead?.source)).length,contactCount:(contacts||[]).length,pendingCount:Object.keys(pending||{}).length,voiceMinutes:Number.isFinite(ws.usage?.voiceMinutes)?ws.usage.voiceMinutes:0,overageBillingEnabled:false,
    calls:real.slice(0,20).map(call=>({...Object.fromEntries(fields.map(key=>[key,typeof call[key]==='string'?redact(call[key]).slice(0,4000):call[key]??null])),transcript:Array.isArray(call.transcript)?call.transcript.slice(0,500).filter(turn=>Array.isArray(turn)&&turn.length===2&&turn.every(text=>typeof text==='string')).map(turn=>turn.map(text=>redact(text).slice(0,8000))):[]}))};
}
module.exports={inspect};
