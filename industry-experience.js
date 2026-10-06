(function(root){
 'use strict';
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function renderCall(call,index=0){
  return `<div class="call-detail-top"><span><i aria-hidden="true"></i> CALL EXAMPLE</span><span>0${index+1} / 06</span></div><h3>${escape(call.title)}</h3><div class="call-exchange"><div><span>CALLER</span><p>${escape(call.caller)}</p></div><div class="call-response"><span>CALLERCORE</span><p>${escape(call.answer)}</p></div></div><div class="capture-heading"><span>THE DETAILS, TOGETHER</span><span aria-hidden="true">↘</span></div><dl class="call-capture">${call.fields.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><div class="call-handoff"><span class="handoff-symbol" aria-hidden="true">↗</span><div><strong>Ready for your team</strong><p>${escape(call.handoff)}</p></div></div><p class="call-example-note">Sample call · not real customer data</p>`;
 }
 if(typeof module==='object'&&module.exports){module.exports={renderCall};return;}
 const data=root.document.getElementById('industry-data'),panel=root.document.getElementById('call-detail');
 if(!data||!panel)return;
 let calls;try{calls=JSON.parse(data.textContent).calls;}catch(_){return;}
 root.document.querySelectorAll('[data-industry-call]').forEach(button=>button.addEventListener('click',()=>{
  const index=Number(button.dataset.industryCall);if(!calls[index])return;
  root.document.querySelectorAll('[data-industry-call]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  panel.innerHTML=renderCall(calls[index],index);
  panel.setAttribute('aria-label',calls[index].title+' example');
  const motion=root.matchMedia('(prefers-reduced-motion: reduce)');
  if(!motion.matches)panel.animate?.([{opacity:.55,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'ease-out'});
  if(root.matchMedia('(max-width:700px)').matches)panel.scrollIntoView({block:'start',behavior:motion.matches?'instant':'smooth'});
 }));
 const reveal=root.document.querySelectorAll('.industry-reveal');
 if(root.matchMedia('(prefers-reduced-motion: reduce)').matches||!root.IntersectionObserver)return;
 const observer=new root.IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.08});
 reveal.forEach(el=>{el.classList.add('will-reveal');observer.observe(el);});
})(typeof window==='object'?window:globalThis);
