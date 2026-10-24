(function(root){
 'use strict';
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function renderCall(call,index=0){
  const turns=call.turns||[{speaker:'caller',text:call.caller},{speaker:'receptionist',text:call.answer}];
  return `<div class="call-detail-top"><span><i aria-hidden="true"></i> CALL EXAMPLE</span><span>0${index+1} / 06</span></div><h3>${escape(call.title)}</h3><p class="call-scenario-context">${escape(call.context||'Example conversation')}</p><div class="transcript-toolbar"><span>${turns.length} conversation turns</span><button type="button" class="transcript-expand" aria-expanded="false" aria-controls="call-transcript">Read full conversation <span aria-hidden="true">↗</span></button></div><div id="call-transcript" class="call-exchange" tabindex="0" role="region" aria-label="${escape(call.title)} conversation">${turns.map(turn=>`<div class="${turn.speaker==='receptionist'?'call-response':'call-caller'}"><span>${turn.speaker==='receptionist'?'CALLERCORE':'CALLER'}</span><p>${escape(turn.text)}</p></div>`).join('')}</div><div class="capture-heading"><span>${call.resolved?'ANSWERED IN THE CALL':'THE DETAILS, TOGETHER'}</span><span aria-hidden="true">↘</span></div><dl class="call-capture">${call.fields.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><div class="call-handoff"><span class="handoff-symbol" aria-hidden="true">${call.resolved?'✓':'↗'}</span><div><strong>${call.resolved?'Resolved without a callback':'A focused next step for your team'}</strong><p>${escape(call.handoff)}</p></div></div><p class="call-example-note">Sample call · not real customer data. Business details and policies are fictional examples; answers depend on your setup.</p>`;
 }
 if(typeof module==='object'&&module.exports){module.exports={renderCall};return;}
 const data=root.document.getElementById('industry-data'),panel=root.document.getElementById('call-detail');
 if(!data||!panel)return;
 let calls;try{calls=JSON.parse(data.textContent).calls;}catch(_){return;}
 panel.addEventListener('click',event=>{
  const button=event.target.closest('.transcript-expand');if(!button)return;
  const expanded=button.getAttribute('aria-expanded')!=='true';
  button.setAttribute('aria-expanded',String(expanded));
  button.innerHTML=expanded?'Compact conversation <span aria-hidden="true">↙</span>':'Read full conversation <span aria-hidden="true">↗</span>';
  panel.classList.toggle('transcript-is-expanded',expanded);
 });
 root.document.querySelectorAll('[data-industry-call]').forEach(button=>button.addEventListener('click',()=>{
  const index=Number(button.dataset.industryCall);if(!calls[index])return;
  root.document.querySelectorAll('[data-industry-call]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  panel.innerHTML=renderCall(calls[index],index);
  panel.classList.remove('transcript-is-expanded');
  panel.setAttribute('aria-label',calls[index].title+' example');
  const motion=root.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile=root.matchMedia('(max-width:700px)').matches;
  if(!motion.matches)panel.animate?.(mobile?[{opacity:.55},{opacity:1}]:[{opacity:.55,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'ease-out'});
  if(mobile)panel.scrollIntoView({block:'start',behavior:'instant'});
 }));
 const reveal=root.document.querySelectorAll('.industry-reveal');
 if(root.matchMedia('(prefers-reduced-motion: reduce)').matches||!root.IntersectionObserver)return;
 const observer=new root.IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.08});
 reveal.forEach(el=>{el.classList.add('will-reveal');observer.observe(el);});
})(typeof window==='object'?window:globalThis);
