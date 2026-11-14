const {effectiveFollowup}=require('./client-followup-snapshot');
function voiceNotifications(calls,state={}){
  if(!Array.isArray(calls)||!state||typeof state!=='object'||Array.isArray(state)||Object.values(state).some(v=>!v||typeof v!=='object'||Array.isArray(v)))throw Error('Voice follow-up state unavailable');
  return calls.filter(c=>c&&['phone','demo_phone'].includes(c.source)&&['request_captured','message_taken','escalated'].includes(c.disposition))
    .filter(c=>effectiveFollowup(c,state[c.id]).status==='pending')
    .sort((a,b)=>Number(b.createdAt)-Number(a.createdAt)).slice(0,20).map(c=>{
      if(!c.id||!Number.isFinite(Number(c.createdAt)))throw Error('Voice call timestamp unavailable');
      const priority=effectiveFollowup(c,state[c.id]).priority;
      return {id:'call:'+c.id+':followup',title:priority?'Priority call needs follow-up':'New call request',body:(c.caller||'A caller')+' · '+(c.reason||'A message is ready for your team.'),kind:priority?'warning':'info',view:'calls',createdAt:Number(c.createdAt),meta:{callId:c.id}};
    });
}
module.exports={voiceNotifications};
