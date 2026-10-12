/* Inert owner controls. Eligibility and every action are enforced by the server. */
(()=>{
  'use strict';
  const el=id=>document.getElementById('ownerVerify'+id),panel=document.getElementById('agentOpsOwnerVerification');if(!panel)return;
  const records=[];let eligible=false,busy=false,controller=null,active=null,context=null;
  const fresh=()=>{el('Nonce').value=crypto.randomUUID().replaceAll('-','');el('Slot').value='0';};fresh();
  function show(record){records.push({at:new Date().toISOString(),...record});el('Result').textContent=JSON.stringify(records.at(-1),null,2);el('History').textContent=JSON.stringify(records,null,2);}
  function controls(){for(const name of ['Run','Check','Revoke','New','Scenario','Slot','Path'])el(name).disabled=busy||!eligible;el('Cancel').disabled=!busy||!controller;}
  function update(data){const v=data?.ownerVerification;eligible=!!v&&data.paidExecution===false&&v.maxCalls===0&&v.maxMicros===0&&v.expiresAt>Date.now()&&!!v.release?.digest&&!!v.runtime?.origin;context=v;if(!busy)panel.hidden=!eligible;if(eligible)el('Window').textContent='Verification window ends '+new Date(v.expiresAt).toISOString()+'. Paid execution disabled.';controls();}
  async function post(action,input,signal){
    const r=await fetch('/api/agent-operations',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({action,input}),signal:signal||AbortSignal.timeout(15000)});
    const body=await r.json();show({action,input,status:r.status,body});if(!r.ok)throw Error('Verification stopped (HTTP '+r.status+').');return body;
  }
  function binding(){const input={nonce:el('Nonce').value,slot:Number(el('Slot').value)};if(!/^[a-f0-9]{32}$/.test(input.nonce)||!Number.isSafeInteger(input.slot)||input.slot<0||input.slot>7)throw Error('Invalid verification record.');return Object.freeze(input);}
  async function check(input,expected){const r=await post(expected?.path==='transport'?'organization-transport-readback':'organization-lifecycle-verification',{...input,operation:'check'});const v=r.verification,id=(expected?.path==='transport'?'pilot_transport_':'pilot_probe_')+input.nonce+'_'+input.slot,confirmed=v?.release?.digest===expected?.release?.digest&&v?.release?.version===expected?.release?.version&&v?.runtime?.origin===expected?.runtime?.origin&&v?.runtime?.commit===expected?.runtime?.commit&&v?.id===id&&v.record?.id===id&&v.maxCalls===0&&v.maxMicros===0&&v.paidExecution===false&&v.controlAuthority===false&&v.record?.status==='revoked'&&v.record.leaseUntil===0;el('Cleanup').textContent=confirmed?'Central revocation confirmed. No control authority; zero paid calls.':'Shutdown unconfirmed. Preserve this record reference; no paid authority exists.';return confirmed;}
  async function revoke(input,expected){await post(expected?.path==='transport'?'organization-transport-readback':'organization-lifecycle-verification',{...input,operation:'revoke'});return check(input,expected);}
  async function operate(kind){
    if(busy||!eligible)return;let input;try{input=binding();}catch(e){el('Cleanup').textContent=e.message;return;}busy=true;active=input;const expected={...context,path:el('Path').value==='transport'?'transport':'core'};
    try{
      if(kind==='run'){
        controller=new AbortController();controls();el('Cleanup').textContent='Test running; cleanup not yet confirmed.';
        const r=await post(expected.path==='transport'?'organization-supervisor-verification':'organization-node-controller-verification',{...input,scenario:el('Scenario').value},AbortSignal.any([controller.signal,AbortSignal.timeout(45000)]));
        el('Cleanup').textContent=r.controller?.completed?'Controller completed; checking revocation.':'Controller stopped; checking revocation.';
        if(!await check(input,expected)){show({input,cleanupRecoveryRequested:true});await revoke(input,expected);}
      }else if(kind==='revoke')await revoke(input,expected);else await check(input,expected);
    }catch(e){show({input,error:e.message,shutdownUnconfirmed:true});el('Cleanup').textContent='Shutdown unconfirmed; attempting central revocation.';try{await revoke(input,expected);}catch{show({input,cleanupUnconfirmed:true,paidExecution:false});el('Cleanup').textContent='Shutdown unconfirmed. Preserve record reference; controller lease is at most 30 seconds. No paid authority exists.';}}
    finally{controller=null;active=null;busy=false;controls();if(!eligible)panel.hidden=true;}
  }
  el('Run').onclick=()=>operate('run');el('Check').onclick=()=>operate('check');el('Revoke').onclick=()=>operate('revoke');
  el('Cancel').onclick=()=>{controller?.abort();show({input:active,cancellationRequested:true,shutdownUnconfirmed:true});};
  el('New').onclick=()=>{if(!busy&&eligible)fresh();};
  el('Download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({kind:'owner-admin-node-lifecycle-evidence-v1',modelRequests:0,records},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='callercore-owner-verification-'+el('Nonce').value+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  window.CallerCoreOwnerVerification={update};controls();
})();
