'use strict';

// Match the portal's effective status, including legacy calls without saved follow-up state.
// The parity regression runs these rules against the actual dashboard classifier.
const dispositions=new Set(['resolved_by_ai','request_captured','message_taken','transferred','escalated','incomplete','non_customer']);
function dispositionFor(call){
  const saved=String(call?.disposition||'').toLowerCase();if(dispositions.has(saved))return saved;
  const category=String(call?.category||''),outcome=String(call?.outcome||''),reason=String(call?.reason||'');
  if(['Spam','Wrong number'].includes(category))return 'non_customer';
  if(/miss|incomplete|failed/i.test(outcome))return 'incomplete';
  if(category==='Complaint'||/urgent|emergency|gas|carbon monoxide/i.test(reason))return 'escalated';
  if(/transfer/i.test(outcome))return 'transferred';
  if(category==='General question'&&/resolved|answered/i.test(outcome))return 'resolved_by_ai';
  if(['Vendor','Employment','Existing job','Billing','Warranty'].includes(category))return 'message_taken';
  if(['New service','Estimate follow-up'].includes(category)||/qualif|request captured/i.test(outcome))return 'request_captured';
  if(/follow|message/i.test(outcome))return 'message_taken';
  if(/resolved|answered/i.test(outcome))return 'resolved_by_ai';
  return 'message_taken';
}
function effectiveFollowup(call,saved){
  const disposition=dispositionFor(call),requiresFollowup=['request_captured','message_taken','escalated','incomplete'].includes(disposition);
  let status=String(saved?.status||'');
  if(status==='handled')status='completed';if(status==='open')status='needs_action';
  if(!['no_action','needs_action','in_progress','completed','dismissed'].includes(status))status=requiresFollowup?'needs_action':'no_action';
  const pending=['needs_action','in_progress'].includes(status),priority=requiresFollowup&&pending&&(disposition==='escalated'||/no heat|emergency|urgent|gas|carbon monoxide/i.test(String(call?.reason||'')));
  return {disposition,requiresFollowup,status:pending?'pending':status,priority};
}
function buildClientFollowupSnapshot(calls,state={}){
  if(!Array.isArray(calls)||!state||typeof state!=='object'||Array.isArray(state)||Object.values(state).some(item=>!item||typeof item!=='object'||Array.isArray(item)))throw new Error('Unverified follow-up history');
  const totals={pending:0,priority:0,completed:0,dismissed:0,noAction:0,total:0},sample=[];
  for(const call of calls){
    if(!call||typeof call!=='object'||Array.isArray(call)||!String(call.id||''))throw new Error('Unverified call history');
    const info=effectiveFollowup(call,state[String(call.id)]);
    if(info.requiresFollowup){totals.total++;if(info.status==='no_action')totals.noAction++;else totals[info.status]++;if(info.priority)totals.priority++;}
    if(sample.length<50)sample.push({id:call.id,caller:call.caller,reason:call.reason,summary:call.summary,disposition:info.disposition,date:call.date,followup:info.status,requiresFollowup:info.requiresFollowup,priority:info.priority});
  }
  return {totals,calls:sample};
}
module.exports={effectiveFollowup,buildClientFollowupSnapshot};
