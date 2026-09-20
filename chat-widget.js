// CallerCore V2 chat widget — self-contained and backed by /api/chat.
(function(){
  if(window.__ccChatMounted) return; window.__ccChatMounted=true;
  const welcome="Hi — I’m CallerCore’s AI assistant. Ask me how the receptionist works, what a plan includes, or whether it fits your business.";
  const markup=`
    <button class="cc-chat-launcher" id="ccChatLauncher" aria-label="Open CallerCore assistant"><span>AI</span><span>Ask CallerCore</span></button>
    <section class="cc-chat-panel" id="ccChatPanel" aria-label="CallerCore AI assistant">
      <header class="cc-chat-head"><div><span class="cc-chat-avatar">CC</span><div><strong>CallerCore Assistant</strong><small>AI help · usually responds in seconds</small></div></div><button class="cc-chat-close" id="ccChatClose" aria-label="Close chat">×</button></header>
      <div class="cc-chat-messages" id="ccChatMessages"><div class="cc-msg bot">${welcome}</div></div>
      <div class="cc-chat-quick" id="ccChatQuick"><button data-q="How does CallerCore work for a service business?">How it works</button><button data-q="What do the plans include?">Plans</button><button data-q="Can I hear the AI before signing up?">Try the AI</button></div>
      <form class="cc-chat-form" id="ccChatForm"><input id="ccChatInput" autocomplete="off" placeholder="Ask about CallerCore…"><button aria-label="Send">→</button></form>
    </section>`;
  function mount(){
    const box=document.createElement('div');box.innerHTML=markup;while(box.firstChild)document.body.appendChild(box.firstChild);
    const launcher=document.getElementById('ccChatLauncher'),panel=document.getElementById('ccChatPanel'),close=document.getElementById('ccChatClose'),messages=document.getElementById('ccChatMessages'),form=document.getElementById('ccChatForm'),input=document.getElementById('ccChatInput'),quick=document.getElementById('ccChatQuick');
    const history=[];let busy=false;
    const add=(text,who)=>{const d=document.createElement('div');d.className='cc-msg '+who;d.textContent=text;messages.appendChild(d);messages.scrollTop=messages.scrollHeight;return d};
    const open=()=>{panel.classList.add('open');launcher.style.display='none';setTimeout(()=>input.focus(),120)};
    const shut=()=>{panel.classList.remove('open');launcher.style.display='flex'};
    launcher.addEventListener('click',open);close.addEventListener('click',shut);
    async function send(text){
      text=(text||'').trim();if(!text||busy)return;busy=true;add(text,'user');input.value='';quick.style.display='none';
      history.push({role:'user',content:text});const typing=add('Thinking…','bot typing');
      try{
        const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history})});
        if(!r.ok) throw new Error('chat');
        const data=await r.json();typing.remove();add(data.reply,'bot');history.push({role:'assistant',content:data.reply});
      }catch(e){typing.remove();add("I’m having trouble connecting right now. You can use Talk to us and the CallerCore team will help.",'bot')}
      busy=false;
    }
    form.addEventListener('submit',e=>{e.preventDefault();send(input.value)});
    quick.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>send(b.dataset.q)));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();