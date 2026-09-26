// CallerCore public AI assistant. UI is self-contained and uses /api/chat.
(function(){
  if(window.__ccChatMounted) return;
  window.__ccChatMounted=true;

  const welcome="Hi — I’m CallerCore’s AI assistant. Ask me how the receptionist works, what a plan includes, or whether it fits your business.";
  const markup=`
    <button class="cc-chat-launcher" id="ccChatLauncher" type="button" aria-label="Open CallerCore AI assistant" aria-haspopup="dialog" aria-controls="ccChatPanel" aria-expanded="false"><span aria-hidden="true">AI</span><span>Ask CallerCore</span></button>
    <section class="cc-chat-panel" id="ccChatPanel" role="dialog" aria-modal="false" aria-labelledby="ccChatTitle" aria-hidden="true">
      <header class="cc-chat-head"><div><span class="cc-chat-avatar" aria-hidden="true">CC</span><div><strong id="ccChatTitle">CallerCore Assistant</strong><small>AI help · usually responds in seconds</small></div></div><button class="cc-chat-close" id="ccChatClose" type="button" aria-label="Close AI assistant">×</button></header>
      <div class="cc-chat-messages" id="ccChatMessages" role="log" aria-live="polite" aria-relevant="additions"><div class="cc-msg bot">${welcome}</div></div>
      <div class="cc-chat-quick" id="ccChatQuick" aria-label="Suggested questions"><button type="button" data-q="How does CallerCore work for a service business?">How it works</button><button type="button" data-q="What do the plans include?">Plans</button><button type="button" data-q="Can I hear the AI before signing up?">Try the AI</button><button type="button" id="ccChatHandoffButton">Talk to the team</button></div>
      <form class="cc-chat-handoff" id="ccChatHandoff" hidden>
        <strong>Have the CallerCore team follow up</strong>
        <input name="name" autocomplete="name" placeholder="Your name" required>
        <input name="email" type="email" autocomplete="email" placeholder="Email" required>
        <input name="phone" type="tel" autocomplete="tel" placeholder="Phone (optional)">
        <textarea name="message" placeholder="What can we help with?" required></textarea>
        <div><button type="button" id="ccChatHandoffCancel">Cancel</button><button type="submit">Send to team</button></div>
        <small id="ccChatHandoffStatus" role="status"></small>
      </form>
      <form class="cc-chat-form" id="ccChatForm"><label class="sr-only" for="ccChatInput">Ask CallerCore a question</label><input id="ccChatInput" autocomplete="off" maxlength="3000" placeholder="Ask about CallerCore…" aria-label="Ask CallerCore a question"><button type="submit" aria-label="Send message">→</button></form>
    </section>`;

  function mount(){
    const box=document.createElement('div');
    box.innerHTML=markup;
    while(box.firstChild) document.body.appendChild(box.firstChild);

    const launcher=document.getElementById('ccChatLauncher');
    const panel=document.getElementById('ccChatPanel');
    const close=document.getElementById('ccChatClose');
    const messages=document.getElementById('ccChatMessages');
    const form=document.getElementById('ccChatForm');
    const input=document.getElementById('ccChatInput');
    const quick=document.getElementById('ccChatQuick');
    const handoff=document.getElementById('ccChatHandoff');
    const handoffButton=document.getElementById('ccChatHandoffButton');
    const handoffCancel=document.getElementById('ccChatHandoffCancel');
    const handoffStatus=document.getElementById('ccChatHandoffStatus');
    const history=[];
    let busy=false;

    const add=(message,who)=>{
      const d=document.createElement('div');
      d.className='cc-msg '+who;
      d.textContent=message;
      messages.appendChild(d);
      messages.scrollTop=messages.scrollHeight;
      return d;
    };

    const setOpen=(open)=>{
      panel.classList.toggle('open',open);
      panel.setAttribute('aria-hidden',String(!open));
      launcher.setAttribute('aria-expanded',String(open));
      launcher.style.display=open?'none':'flex';
      if(open) setTimeout(()=>input.focus(),80);
      else launcher.focus();
    };

    launcher.addEventListener('click',()=>{setOpen(true);window.CallerCoreAnalytics?.track('chat_open',{label:'website_assistant'})});
    close.addEventListener('click',()=>setOpen(false));
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape' && panel.classList.contains('open')) setOpen(false);
    });

    async function send(text){
      text=(text||'').trim();
      if(!text||busy) return;
      busy=true;
      form.setAttribute('aria-busy','true');
      add(text,'user');
      input.value='';
      quick.hidden=true;
      history.push({role:'user',content:text});
      window.CallerCoreAnalytics?.track('chat_message',{label:'visitor_message'});
      const typing=add('Thinking…','bot typing');

      try{
        const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({messages:history})});
        if(!r.ok) throw new Error('chat');
        const data=await r.json();
        typing.remove();
        add(data.reply||'I could not generate a response just now.','bot');
        if(data.reply) history.push({role:'assistant',content:data.reply});
      }catch(e){
        typing.remove();
        add("I’m having trouble connecting right now. Use Talk to us and the CallerCore team will help.",'bot');
      }finally{
        busy=false;
        form.removeAttribute('aria-busy');
        input.focus();
      }
    }

    form.addEventListener('submit',e=>{e.preventDefault();send(input.value)});
    quick.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>send(b.dataset.q)));
    handoffButton?.addEventListener('click',()=>{
      quick.hidden=true;form.hidden=true;handoff.hidden=false;
      const last=[...history].reverse().find(x=>x.role==='user');
      if(last&&handoff.elements.message&&!handoff.elements.message.value)handoff.elements.message.value=last.content.slice(0,1000);
      window.CallerCoreAnalytics?.track('chat_handoff',{label:'handoff_open'});
    });
    handoffCancel?.addEventListener('click',()=>{handoff.hidden=true;form.hidden=false;quick.hidden=false;handoffStatus.textContent=''});
    handoff?.addEventListener('submit',async e=>{
      e.preventDefault();if(!handoff.reportValidity())return;
      const btn=handoff.querySelector('button[type="submit"]'),d=new FormData(handoff),a=window.CallerCoreAnalytics?.context||{};
      btn.disabled=true;btn.textContent='Sending…';handoffStatus.textContent='';
      const payload={name:d.get('name'),business:'',email:d.get('email'),phone:d.get('phone'),category:'Chatbot inquiry',message:d.get('message'),visitorId:a.visitorId||'',sessionId:a.sessionId||'',utmSource:a.utmSource||'',utmMedium:a.utmMedium||'',utmCampaign:a.utmCampaign||''};
      try{
        const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(data.error||'Could not send');
        window.CallerCoreAnalytics?.track('chat_handoff',{label:'handoff_submitted'});
        handoff.innerHTML='<div class="cc-chat-handoff-success"><b>✓</b><strong>Sent to the CallerCore team.</strong><small>We’ll follow up using the email you provided.</small></div>';
      }catch(err){handoffStatus.textContent=err.message||'Could not send. Please try again.';btn.disabled=false;btn.textContent='Send to team'}
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
  else mount();
})();