const {compareAndAuditBatch}=require('./config-transaction');
const {revision,E164}=require('./voice-policy');
class VoiceConflict extends Error{}
function array(value){if(value==null)return [];if(!Array.isArray(value))throw new Error('Voice history unavailable');return value}
function object(value){if(value==null)return {};if(typeof value!=='object'||Array.isArray(value))throw new Error('Voice state unavailable');return value}
function callView(record){
  const request=record.request||{},followup=record.status==='ended'&&!['wrong_number','spam'].includes(request.intent)&&!['resolved_by_ai','non_customer'].includes(record.disposition);
  const seconds=record.durationSeconds||0;
  const incomplete=record.status==='ended'&&!request.intent&&!record.disposition;
  return {id:record.id,caller:request.name||'Caller',phone:request.callbackNumber||record.callerNumber||'',calledNumber:record.calledNumber||'',address:request.address||'',category:({service:'New service',estimate:'Estimate follow-up',existing_customer:'Existing job',appointment:'Appointment request',status:'Existing job',complaint:'Complaint',reschedule:'Scheduling',cancel:'Scheduling',billing:'Billing',human:'Human request',general:'General question',wrong_number:'Wrong number',spam:'Spam'})[request.intent]||(record.disposition==='non_customer'?'Non-customer':'General question'),reason:request.reason||'Phone call',disposition:record.status!=='ended'?'in_progress':incomplete?'incomplete':record.disposition||(['service','estimate'].includes(request.intent)?'request_captured':followup?'message_taken':'non_customer'),duration:Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'),durationSeconds:record.durationVerified?seconds:null,outcome:record.status!=='ended'?'In progress':incomplete?'Missed':followup?'Follow-up':'Resolved',agent:record.agentName||'CallerCore',createdAt:record.startedAt||record.receivedAt,date:new Date(record.startedAt||record.receivedAt).toISOString(),time:new Date(record.startedAt||record.receivedAt).toISOString(),summary:record.summary||request.reason||'Call details are pending.',transcript:(record.transcript||[]).map(t=>[t.speaker,t.text]),transcriptState:record.transcriptState||'pending',recordingState:record.recordingAvailable?'unexpected_recording':'disabled',transferState:record.transfer?.state||'not_requested',source:record.purpose==='demo'?'demo_phone':'phone',sample:record.purpose==='demo',contactId:record.contactId||null};
}
// All CRM/call/usage/journal changes share one optimistic atomic transaction.
// Retry re-reads state; a provider replay or concurrent tool cannot partially save.
async function mutateCall(kv,binding,canonical,operation,transform,{now=Date.now()}={}){
  const wsid=binding.workspaceId,key='voice:call:'+canonical.id;
  for(let attempt=0;attempt<5;attempt++){
    const keys=[key,'workspace:'+wsid,'calls:'+wsid,'calls:index:'+wsid,'leads:'+wsid,'voice:contacts:'+wsid,'voice:usage:'+wsid,'voice:journal:'+canonical.id,'voice:pending:'+wsid];
    const raw=await Promise.all(keys.map(k=>kv.get(k))),previous=raw[0],ws=raw[1];
    if(!ws||typeof ws!=='object'||Array.isArray(ws)||ws.deletedAt||ws.status==='deleted'||ws.billingStatus==='suspended')throw new Error('Voice workspace unavailable');
    const journal=structuredClone(object(raw[7])),prior=previous?object(previous):null;
    if(prior&&(prior.workspaceId!==wsid||prior.providerCallId!==canonical.providerCallId))throw new Error('Voice call association mismatch');
    if(Object.hasOwn(journal,operation))return journal[operation];
    if(Object.keys(journal).length>=120)throw new Error('Call operation limit reached');
    const record=prior?structuredClone(prior):{...canonical,workspaceId:wsid,purpose:binding.purpose,receivedAt:now,agentName:binding.agentName};
    const result=await transform(record,prior);
    const calls=structuredClone(array(raw[2])),index=structuredClone(array(raw[3])),leads=structuredClone(array(raw[4])),contacts=structuredClone(array(raw[5])),usage=structuredClone(object(raw[6]));
    if(calls.length>=10000&&!calls.some(c=>c.id===record.id))throw new Error('Call retention limit reached');
    let contactId=record.contactId;
    const number=record.request?.callbackNumber||record.callerNumber;
    if(E164.test(number||'')&&!['spam','wrong_number'].includes(record.request?.intent)){
      contactId='contact_'+revision(wsid+':'+number).slice(0,24);
      const old=contacts.find(c=>c.id===contactId),contact={...(old||{}),id:contactId,phone:number,name:record.request?.name||old?.name||'Caller',createdAt:old?.createdAt||now,updatedAt:now};
      record.contactId=contactId;
      const n=contacts.findIndex(c=>c.id===contactId);if(n<0)contacts.push(contact);else contacts[n]=contact;
    }
    if(record.request&&['service','estimate'].includes(record.request.intent)){
      const associated=leads.find(l=>(l.id===record.leadId||l.callId===record.id||l.callIds?.includes(record.id))&&['New','Contacted','Qualified'].includes(l.stage));
      const match=associated||(contactId?leads.find(l=>l.contactId===contactId&&['New','Contacted','Qualified'].includes(l.stage)&&String(l.service||'').trim().toLowerCase()===record.request.reason.trim().toLowerCase()):null);
      const leadId=match?.id||'lead_'+record.id,n=leads.findIndex(l=>l.id===leadId),old=n<0?{}:leads[n];
      const lead={...old,id:leadId,name:record.request.name||'Caller',phone:number||'',address:record.request.address||'',service:record.request.reason,stage:old.stage||'New',value:0,source:record.purpose==='demo'?'Demo call':'Phone call',callId:record.id,callIds:[...new Set([...(old.callIds||[]),record.id])],contactId,createdAt:old.createdAt||now,updatedAt:now};
      record.leadId=leadId;if(n<0)leads.unshift(lead);else leads[n]=lead;
    }else{const n=leads.findIndex(l=>l.id==='lead_'+record.id);if(n>=0&&leads[n].stage==='New')leads.splice(n,1)}
    const ledger=object(usage.calls),priorSeconds=Number(ledger[record.id]?.seconds||0);
    // Current release tracks connected seconds fractionally. It does not round
    // to a price or generate an overage invoice. Monthly attribution is explicit.
    if(record.status==='ended'&&record.durationVerified&&record.durationSeconds!==priorSeconds){
      const month=new Date(record.startedAt).toISOString().slice(0,7);
      ledger[record.id]={seconds:record.durationSeconds,month,purpose:binding.purpose};
    }
    usage.calls=ledger;usage.overageEnabled=false;
    const month=new Date(now).toISOString().slice(0,7),currentSeconds=Object.values(ledger).filter(v=>v.month===month).reduce((a,v)=>a+v.seconds,0);
    const existingUsage=object(ws.usage);const previousVoiceMinutes=Number(existingUsage.voiceMinutes||0);
    const nextWorkspace={...ws,usage:{...existingUsage,minutes:Math.max(0,Number(existingUsage.minutes||0)-previousVoiceMinutes+currentSeconds/60),voiceMinutes:currentSeconds/60,voiceMonth:month},updatedAt:now};
    const view=callView(record);for(const collection of [calls,index]){const n=collection.findIndex(c=>c.id===record.id);if(n<0)collection.unshift(view);else collection[n]=view}
    journal[operation]=result;
    const pending=structuredClone(object(raw[8]));if(record.status!=='ended'||record.transcriptState!=='available'||!record.durationVerified)pending[record.id]=true;else delete pending[record.id];
    const after=[record,nextWorkspace,calls,index,leads,contacts,usage,journal,pending];
    const event={id:'voice_'+revision(record.id+':'+operation).slice(0,24),workspaceId:wsid,actorRole:'voice_service',action:'voice_call_update',section:'calls',at:now,meta:{callId:record.id,operation:operation.slice(0,100),purpose:binding.purpose}};
    if(await compareAndAuditBatch(kv,keys.map((k,i)=>({key:k,before:raw[i],after:after[i]})),'audit:'+wsid,event))return result;
  }
  throw new VoiceConflict('Call changed concurrently. Retry with the same operation.');
}
async function ingest(kv,binding,canonical){
  const op='event:'+revision(canonical);
  return mutateCall(kv,binding,canonical,op,record=>{
    // Never regress final state on delayed start/status notifications. Empty
    // artifacts do not erase a previously verified transcript or summary.
    if(record.status!=='ended'||canonical.status==='ended'){
      record.status=canonical.status;record.startedAt=canonical.startedAt||record.startedAt;
      if(canonical.status==='ended'){record.endedAt=canonical.endedAt;record.endedReason=canonical.endedReason;if(canonical.durationVerified){record.durationVerified=true;record.durationSeconds=canonical.durationSeconds}}
    }
    if(canonical.transcript.length){record.transcript=canonical.transcript;record.transcriptState='available'}
    if(canonical.summary)record.summary=canonical.summary;record.recordingAvailable=canonical.recordingAvailable||record.recordingAvailable||false;
    if(canonical.status==='ended'&&record.transfer?.state==='requested')record.transfer={...record.transfer,state:'unverified',connected:false};
    return {ok:true,callId:record.id};
  });
}
module.exports={mutateCall,ingest,callView,VoiceConflict};
