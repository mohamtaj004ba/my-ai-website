(function(){
  'use strict';
  const toggle=document.getElementById('helpToggle'),panel=document.getElementById('loginSupport'),form=document.getElementById('supportForm'),status=document.getElementById('supportStatus'),button=document.getElementById('supportSubmit');
  if(!toggle||!panel||!form)return;
  let pending=false,submitted=false;
  toggle.addEventListener('click',()=>{
    panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));
    if(!panel.hidden){const email=document.getElementById('supportEmail');if(!email.value)email.value=document.getElementById('email').value;document.getElementById('supportName').focus();}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending||submitted)return;
    pending=true;button.disabled=true;button.textContent='Sending…';status.textContent='';status.dataset.state='';
    const fields=new FormData(form),payload={name:fields.get('name'),email:fields.get('email'),message:fields.get('message'),category:'Login help'};
    const controls=[...form.querySelectorAll('input,textarea')];controls.forEach(el=>el.disabled=true);
    try{
      const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
      const data=await response.json().catch(()=>null);
      if(!response.ok||!data||typeof data!=='object'||Array.isArray(data)||data.ok!==true||!String(data.prospectId||''))throw new Error('receipt');
      submitted=true;status.dataset.state=data.warning?'error':'success';
      status.textContent=data.warning?'Your request was saved, but its delivery could not be fully confirmed. Email support@callercore.com if you need urgent help.':'Your help request is saved. We’ll reply to the email you provided.';
      button.textContent='Request sent';
    }catch(error){
      status.dataset.state='error';status.textContent=error.name==='TimeoutError'?'We couldn’t confirm receipt yet. Your request may have arrived. Email support@callercore.com if you need help now.':'We couldn’t confirm your request. Please try again or email support@callercore.com.';
      button.disabled=false;button.textContent='Send help request';controls.forEach(el=>el.disabled=false);
    }finally{pending=false;}
  });
})();
