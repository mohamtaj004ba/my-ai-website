/* Owner Pilot Control: same authenticated API and authoritative supervisor. No approvals are created here. */
(()=>{
  'use strict';
  const panel=document.getElementById('agentOpsPilotControl'),el=name=>document.getElementById('pilotControl'+name);if(!panel)return;
  const records=[],attempted=new Set();let state=null,verification=null,verifying=false,running=false,stopping=false,controller=null,activeId=null;
  const ids=()=>[...new Set([activeId,state?.configured?.id,...(state?.approvals||[]).filter(a=>a.status!=='revoked').map(a=>a.id)].filter(Boolean))];
  function record(value){records.push({at:new Date().toISOString(),...value});el('Evidence').textContent=JSON.stringify(records,null,2);}
  function startable(){const c=state?.configured;return !!c&&state.version==='owner-pilot-control-v1'&&state.canStart===true&&/^[a-f0-9]{64}$/.test(c.approvalHash)&&c.expiresAt>Date.now()&&c.maxCalls===5&&c.maxMicros===3600000&&c.sourceCommit===state.runtime?.commit&&c.contractHash===state.release?.digest&&c.contractVersion===state.release?.version&&!attempted.has(c.id);}
  function controls(){el('Start').disabled=running||verifying||stopping||!startable();el('Cancel').disabled=stopping||!(running||ids().length);el('Emergency').disabled=stopping||!ids().length;el('Refresh').disabled=stopping;el('Verify').disabled=running||verifying||stopping||state?.paidExecution!==false||verification?.expiresAt<=Date.now()||!verification||verification.maxCalls!==0||verification.maxMicros!==0;}
  function update(data){state=data?.ownerPilotControl||null;verification=data?.ownerVerification||null;panel.hidden=!state&&!running&&!activeId;if(state){el('Status').textContent=state.paidExecution?'Specific paid pilot enabled. Starting requires its valid owner approval.':state.canStart?'Specific approved pilot ready to activate. Central dispatch authority is not yet active.':'Paid execution disabled. No model request can be started here.';el('Binding').textContent=JSON.stringify({configured:state.configured,runtime:state.runtime,release:state.release,limits:state.limits},null,2);el('Budget').textContent=JSON.stringify(state.budget,null,2);el('Tasks').textContent=JSON.stringify({approvals:state.approvals,workflows:state.workflows},null,2);}else if(!panel.hidden)el('Status').textContent='Owner session or status unavailable. Do not restart. Cleanup is not confirmed.';controls();}
  async function request(body,signal,accept='application/json'){
    const response=await fetch('/api/agent-operations',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json',Accept:accept},...(body?{body:JSON.stringify(body)}:{}),signal:signal||AbortSignal.timeout(15000)});
    if(!response.ok){record({httpStatus:response.status,action:body?.action||'status'});throw Error('Owner operation denied or unavailable (HTTP '+response.status+').');}return response;
  }
  async function refresh(){try{const response=await request();const data=await response.json();update(data);return state;}catch(e){update(null);el('Cleanup').textContent=e.message+' Status and cleanup remain unconfirmed.';throw e;}}
  async function stop(targets=ids()){
    if(stopping)return;stopping=true;controls();const exact=[...targets];let revoked=true;
    for(const id of exact){try{await(await request({action:'organization-pilot-stop',input:{id}})).json();record({approvalId:id,centralRevocationRequested:true});}catch(e){revoked=false;record({approvalId:id,revocationUnconfirmed:true,error:e.message});}}
    controller?.abort();
    try{const current=await refresh();const confirmed=revoked&&!!current&&exact.every(id=>current.approvals?.some(a=>a.id===id&&a.status==='revoked'&&a.leaseUntil===0));el('Cleanup').textContent=confirmed?'Central revocation confirmed for these approvals. Deployment paid-disable and independent broker readbacks remain required.':'Shutdown unconfirmed. Use emergency stop after restoring owner access; do not retry Start.';if(confirmed&&exact.includes(activeId))activeId=null;}catch{el('Cleanup').textContent='Shutdown unconfirmed. Restore owner access and revoke; do not retry Start.';}finally{stopping=false;controls();}
  }
  async function start(){
    if(running||verifying||stopping||!startable())return;
    const id=state.configured.id;attempted.add(id);activeId=id;running=true;controller=new AbortController();controls();el('Cleanup').textContent='Controller requested. Central shutdown not yet confirmed.';record({approvalId:id,controllerRequested:true});
    try{
      const response=await request({action:'organization-pilot-controller',input:{id,approvalHash:state.configured.approvalHash,workflowId:state.configured.workflowId,contractHash:state.configured.contractHash,sourceCommit:state.configured.sourceCommit,deploymentOrigin:state.runtime.origin}},AbortSignal.any([controller.signal,AbortSignal.timeout(620000)]),'application/x-ndjson');
      const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
      for(;;){const chunk=await reader.read();pending+=decoder.decode(chunk.value||new Uint8Array(),{stream:!chunk.done});if(pending.length>2000000)throw Error('Controller receipt limit exceeded.');let boundary;while((boundary=pending.indexOf('\n'))>=0){const line=pending.slice(0,boundary);pending=pending.slice(boundary+1);if(line)record({receipt:JSON.parse(line)});}if(chunk.done){if(pending.trim())throw Error('Incomplete controller receipt.');break;}}
      el('Status').textContent='Controller transport completed. Review execution, independent QA, and task acceptance separately.';
    }catch(e){record({approvalId:id,controllerStopped:true,error:e.message});el('Status').textContent='Controller stopped or disconnected. No automatic retry. Preserve evidence.';}
    finally{running=false;controller=null;if(!stopping)await stop([id]);controls();}
  }
  async function verify(){
    controls();if(el('Verify').disabled)return;verifying=true;const input=Object.freeze({nonce:crypto.randomUUID().replaceAll('-',''),slot:0}),expected=verification;controls();let confirmed=false;record({nonbillable:true,input,verificationStarted:true});
    try{const body=await(await request({action:'organization-supervisor-verification',input:{...input,scenario:'success'}},AbortSignal.timeout(45000))).json();record({nonbillable:true,input,body});}
    catch(e){record({nonbillable:true,input,error:e.message});}
    finally{
      try{await(await request({action:'organization-transport-readback',input:{...input,operation:'revoke'}})).json();const body=await(await request({action:'organization-transport-readback',input:{...input,operation:'check'}})).json(),v=body.verification,id='pilot_transport_'+input.nonce+'_0';confirmed=v?.id===id&&v.record?.id===id&&v.record.status==='revoked'&&v.record.leaseUntil===0&&v.paidExecution===false&&v.controlAuthority===false&&v.maxCalls===0&&v.maxMicros===0&&v.release?.digest===expected.release?.digest&&v.runtime?.origin===expected.runtime?.origin;record({nonbillable:true,input,cleanupConfirmed:confirmed,body});}catch(e){record({nonbillable:true,input,cleanupConfirmed:false,error:e.message});}
      el('VerifyStatus').textContent=confirmed?'Non-billable supervisor/worker verification cleanup confirmed. This does not authorize or verify a paid model request.':'Non-billable cleanup unconfirmed. Preserve the record; do not repeat automatically.';verifying=false;controls();
    }
  }
  el('Start').onclick=start;el('Cancel').onclick=()=>stop();el('Emergency').onclick=()=>stop();el('Refresh').onclick=()=>refresh().catch(()=>{});
  el('Verify').onclick=verify;
  el('Download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({kind:'owner-pilot-control-evidence-v1',records},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='callercore-pilot-control-evidence.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  setInterval(controls,1000);window.CallerCorePilotControl={update};controls();
})();
