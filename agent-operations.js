/* Internal admin view. All external/model text is rendered as text, never HTML. */
(()=>{
  'use strict';
  const byId=id=>document.getElementById(id),form=byId('agentOpsForm');if(!form)return;
  let latest=null,busy=false,sequence=0,pendingKey=null;
  const status=byId('agentOpsStatus'),create=byId('agentOpsCreate');
  function text(tag,value){const e=document.createElement(tag);e.textContent=value;return e;}
  async function request(body){
    const r=await fetch('/api/agent-operations',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const data=await r.json();if(!r.ok)throw new Error(data.error||'Agent Operations is unavailable.');return data;
  }
  function render(data){
    if(!Array.isArray(data.tasks)||!Array.isArray(data.agents)||!Array.isArray(data.reservations))throw new Error('Task state is incomplete.');
    latest=data;create.disabled=busy;
    window.CallerCoreOwnerVerification?.update(data);
    window.CallerCorePilotControl?.update(data);
    window.CallerCoreTrustedReview?.update(data);
    window.CallerCoreOperations?.update(data);
    const counts={};for(const t of data.tasks)counts[t.status]=(counts[t.status]||0)+1;
    const reserved=data.reservations.reduce((n,r)=>n+r.ceilingMicros,0),actual=data.reservations.reduce((n,r)=>n+(r.actualMicros||0),0),unknown=data.reservations.filter(r=>r.status==='pending').length;
    byId('agentOpsSummary').textContent=(data.paidExecution?'Paid authority is active; inspect the bound workflow. ':'Paid execution disabled. ')+data.tasks.length+' tasks · '+Object.entries(counts).map(([k,v])=>k.replaceAll('_',' ')+': '+v).join(' · ')+' · Ceiling reserved $'+(reserved/1e6).toFixed(2)+' · Recorded cost $'+(actual/1e6).toFixed(4)+' · Unresolved executions '+unknown+'. Mock reservations are synthetic budget tests.';
    const directory=byId('agentOpsDirectory');directory.replaceChildren();if(data.hybridVisualQA)directory.append(text('p','Visual QA candidate: '+data.hybridVisualQA.model+' · '+data.hybridVisualQA.reasoningEffort+' reasoning · '+(data.hybridVisualQA.modelAccessVerified&&data.hybridVisualQA.visionBoundVerified?'Prepared for a separately approved evaluation.':'Live evaluation blocked until model access and image spending bounds are verified.')));
    for(const a of data.agents)directory.append(text('p',a.role+' · '+a.model+' · v'+a.version+' · Tools: '+a.tools.join(', ')));
    const tasks=byId('agentOpsTasks');tasks.replaceChildren();
    if(!data.tasks.length)tasks.append(text('p','No tasks queued.'));
    for(const t of [...data.tasks].reverse()){
      const card=text('article','');card.className='panel';card.append(text('h3',t.objective),text('p',t.mode.toUpperCase()+' · '+t.status.replaceAll('_',' ')+' · Stage '+t.stage+' · '+t.calls+'/'+(t.profile===data.hybridVisualQA?.profile?data.hybridVisualQA.maxCalls:t.profile===data.evidenceFirstQA?.profile?data.evidenceFirstQA.maxCalls:6)+' executions · '+t.attempts+'/2 inspection attempts'),text('p','Task '+t.id),text('p','Starting commit '+t.scope.commit+' · Preview '+t.scope.origin));
      card.append(text('p','Last activity '+new Date(t.updatedAt).toLocaleString()+' · Lease '+(t.leaseUntil?new Date(t.leaseUntil).toLocaleTimeString():'none')));
      if(t.outcomes)card.append(text('p','Execution validation: '+t.outcomes.structural+' · Evidence: '+t.outcomes.integrity+' · Accuracy: '+t.outcomes.substantive+' · Final acceptance: '+t.outcomes.finalAcceptance+'. Completed execution does not establish accepted work.'));
      if(!['verified','failed','blocked','cancelled'].includes(t.status)){
        const cancel=text('button','Cancel task');cancel.type='button';cancel.className='secondary-btn';cancel.disabled=busy;
        cancel.addEventListener('click',()=>mutate({action:'cancel',id:t.id,expectedRevision:t.revision}));card.append(cancel);
      }
      const detail=text('details','');detail.append(text('summary','Progress, review and artifacts'),text('pre',JSON.stringify({events:t.events,results:t.results,usage:t.usage},null,2)));card.append(detail);tasks.append(card);
    }
  }
  async function refresh(){
    const id=++sequence;status.textContent='Refreshing persisted task state…';
    try{const data=await request();if(id!==sequence)return;render(data);status.textContent='Updated '+new Date().toLocaleTimeString()+'. '+(data.mode==='mock'?'Development results are synthetic.':'');}
    catch(e){if(id!==sequence)return;latest=null;window.CallerCoreOwnerVerification?.update(null);window.CallerCorePilotControl?.update(null);window.CallerCoreTrustedReview?.update(null);window.CallerCoreOperations?.update(null);create.disabled=true;byId('agentOpsTasks').querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent=e.message+' Previously displayed state may be outdated.';}
  }
  async function mutate(body){
    if(busy||!latest)return;busy=true;create.disabled=true;byId('agentOpsTasks').querySelectorAll('button').forEach(b=>b.disabled=true);
    try{await request(body);if(body.action==='create')pendingKey=null;await refresh();}
    catch(e){status.textContent=e.message+' Refresh before retrying; delivery may be uncertain.';latest=null;}
    finally{busy=false;create.disabled=!latest;if(latest)render(latest);}
  }
  form.addEventListener('submit',e=>{e.preventDefault();if(!pendingKey)pendingKey=crypto.randomUUID();mutate({action:'create',objective:byId('agentOpsObjective').value,idempotencyKey:pendingKey});});
  byId('agentOpsRefresh').addEventListener('click',refresh);
  // Poll only this visible operations view; this does not execute workers.
  setInterval(()=>{if(!busy&&!document.hidden&&byId('view-agent-operations')?.classList.contains('active'))refresh();},10000);
  window.CallerCoreAgentOperations={refresh};
})();
