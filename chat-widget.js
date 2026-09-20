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
      <div class="cc-chat-quick" id="ccChatQuick" aria-label="Suggested questions"><button type="button" data-q="How does CallerCore work for a service business?">How it works</button><button type="button" data-q="What do the plans include?">Plans</button><button type="button" data-q="Can I hear the AI before signing up?">Try the AI</button></div>
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

    launcher.addEventListener('click',()=>setOpen(true));
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
    quick.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>send(b.dataset.q)));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
  else mount();
})();