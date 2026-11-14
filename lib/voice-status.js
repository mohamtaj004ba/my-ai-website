// Inventory/configuration is not provider evidence. This remains closed until
// a real provider adapter verifies activation and implements call controls.
function voiceStatus(routing){
  const assigned=!!String(routing?.number||'').trim();
  return {state:assigned?'awaiting_activation':'unassigned',label:assigned?'Awaiting activation':'Not assigned',operational:false,controlsAvailable:false,detail:assigned?'Number and routing settings are saved. Live calling has not been activated and verified.':'A CallerCore number has not been assigned yet.'};
}
function clientRouting(item,{smsLive=false}={}){
  if(!item)return null;
  return {number:item.number||'',label:item.label||'Primary',provider:item.provider||'Vapi',forwardingFrom:item.forwardingFrom||'',transferNumber:item.transferNumber||'',afterHours:item.afterHours||'ai',smsEnabled:smsLive&&item.smsEnabled!==false,status:item.status||'configured',pauseFallbackNumber:item.pauseFallbackNumber||'',voice:voiceStatus(item)};
}
module.exports={voiceStatus,clientRouting};
