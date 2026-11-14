(function(root){
 'use strict';
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const drawings={
  medical:'<path d="M75 265l160-55 135 50-165 57z"/><path d="M75 265v48l130 55v-51m0 51l165-57v-51"/><path d="M135 246l62-21 75 27-65 22z"/><path d="M137 246v24l69 27v-23m0 23l66-22v-23"/><path d="M268 292v-59l37-13 34 13v59m-54-58l17 6 17-6"/><circle cx="109" cy="216" r="13"/><path d="M95 256v-22q14-17 28 0v14m-17-17v22"/><circle cx="224" cy="194" r="13"/><path d="M210 234v-22q14-17 28 0v23"/>',
  automotive:'<path d="M55 293l172-59 180 61-169 65z"/><path d="M100 282l22-51 113-37 82 28 33 53-115 40z"/><path d="M122 231l111 38 84-47m-84 47l2 46m-104-72l17-26 67-23 46 17-65 24z"/><ellipse cx="152" cy="291" rx="11" ry="17"/><ellipse cx="291" cy="292" rx="11" ry="17"/><path d="M79 206v121m305-121v121m-307-121l154-53 153 53"/>',
  property:'<path d="M65 292l162-56 178 61-164 60z"/><path d="M120 277V147l115-40 105 41v132l-104 39z"/><path d="M120 147l116 44 104-43m-104 43v128"/><path d="M140 175l22 8v24l-22-8zm43 16l22 8v24l-22-8zm-43 35l22 8v24l-22-8zm43 16l22 8v24l-22-8zm78-32l24-9v26l-24 9zm42-15l20-7v26l-20 7zm-42 62l24-9v26l-24 9zm42-15l20-7v26l-20 7z"/>',
  legal:'<path d="M55 292l178-61 170 61-170 65z"/><path d="M95 261l142-49 114 42-144 51z"/><path d="M112 269v57m220-63v62m-124-20v51"/><path d="M150 245l48-16 38 14-48 17z"/><path d="M150 245v10l37 15 49-17v-10m-31-22v-80m-39 16l39-15 40 15m-72 0l-15 31h31zm66 0l-15 31h31z"/><path d="M273 214v-36l16-5 25 9v36m-40-9l14 5 25-8"/>',
  'home-services':'<path d="M50 294l177-61 184 64-177 63z"/><path d="M85 275v-88l81-28 94 34v88l-81 30z"/><path d="M72 190l99-92 102 101-94 32z"/><path d="M179 231v80m-69-102l30 11v34l-30-11m84 22l26-10v36l-26 10"/><path d="M278 263l14-37 49-17 46 24v49l-61 21-48-18z"/><path d="M292 226l34 16 47-15m-47 15v61"/><ellipse cx="293" cy="283" rx="9" ry="13"/><ellipse cx="367" cy="289" rx="9" ry="13"/>',
  'professional-services':'<path d="M55 291l171-58 180 62-171 63z"/><path d="M91 255l143-50 119 44-145 51z"/><path d="M107 261v64m102-25v51m130-96v68"/><path d="M165 245v-46l52-18 44 18v46l-51 18z"/><path d="M165 199l46 17 50-17m-50 17v47m-31-17l-24 9 32 12 37-13"/><circle cx="106" cy="211" r="12"/><path d="M93 246v-18q13-15 26 0v15"/><circle cx="305" cy="204" r="12"/><path d="M292 240v-20q13-15 26 0v19"/>'
 };
 function renderScene(scene,index,setting,place){
  const drawing=drawings[setting]||drawings['professional-services'];
  return `<div class="story-panel-top"><span>${escape(scene.period)}</span><span class="story-scene-number">0${index+1} / 03</span></div><h3>${escape(scene.headline)}</h3><p class="story-pressure">${escape(scene.pressure)}</p><div class="attention-stage"><div class="story-stage-label"><span>${escape(place)}</span><span>ON THE PHONE</span></div><svg class="attention-map" viewBox="0 0 800 400" aria-hidden="true"><defs><linearGradient id="scene-floor" x2="1" y2="1"><stop stop-color="#274e46"/><stop offset="1" stop-color="#19382f"/></linearGradient></defs><ellipse class="scene-aura" cx="231" cy="264" rx="195" ry="110"/><g class="scene-drawing" fill="url(#scene-floor)" stroke="#a8c3ae" stroke-width="1.6" stroke-linejoin="round">${drawing}</g><path class="scene-route" d="M700 78C655 78 622 106 622 174"/><path class="scene-route secondary-route" d="M743 137C704 137 667 161 650 196"/><path class="scene-route tertiary-route" d="M530 112C557 112 590 136 599 178"/><circle class="scene-traveler traveler-one" r="4"/><circle class="scene-traveler traveler-two" r="3"/><circle class="scene-traveler traveler-three" r="3"/><circle class="scene-orbit" cx="622" cy="237" r="73"/><circle class="scene-core" cx="622" cy="237" r="51"/><path class="scene-core-mark" d="M607 211h30l15 26-15 26h-30l-15-26z"/><circle cx="622" cy="237" r="8" fill="#e7c19b"/><path class="scene-route outgoing-route" d="M622 290v39q0 20-20 20H469"/><circle class="scene-endpoint" cx="469" cy="349" r="4"/></svg><div class="scene-focus"><span class="scene-focus-dot"></span>${escape(scene.focus)}</div><div class="scene-core-label">CallerCore</div><div class="scene-requests"><div class="scene-request request-one">${escape(scene.calls[0])}</div><div class="scene-request request-two">${escape(scene.calls[1])}</div><div class="scene-request request-three">${escape(scene.calls[2])}</div></div><div class="scene-route-note">A useful answer or a clear next step</div></div><div class="story-responsibilities"><div><span class="responsibility-label">CALLERCORE TAKES ON</span><p>${escape(scene.handles)}</p></div><div><span class="responsibility-label">YOUR TEAM KEEPS</span><p>${escape(scene.retains)}</p></div></div><div class="story-outcome"><span aria-hidden="true">↗</span><p>${escape(scene.outcome)}</p></div>`;
 }
 if(typeof module==='object'&&module.exports){module.exports={renderScene};return;}
 const data=root.document.getElementById('industry-data'),panel=root.document.getElementById('industry-scene'),stage=root.document.getElementById('industry-story');
 if(!data||!panel||!stage)return;
 let story;try{story=JSON.parse(data.textContent);if(!Array.isArray(story.scenes))return;}catch(_){return;}
 const motion=root.matchMedia('(prefers-reduced-motion: reduce)');
 const pause=root.document.querySelector('[data-story-pause]');
 let paused=motion.matches;
 function setPaused(value){paused=value;stage.classList.toggle('story-paused',paused);pause.setAttribute('aria-pressed',String(paused));pause.textContent=paused?'Resume motion':'Pause motion';}
 setPaused(paused);pause.addEventListener('click',()=>setPaused(!paused));
 motion.addEventListener?.('change',event=>setPaused(event.matches));
 root.document.querySelectorAll('[data-story-scene]').forEach(button=>button.addEventListener('click',()=>{
  const index=Number(button.dataset.storyScene);if(!story.scenes[index])return;
  root.document.querySelectorAll('[data-story-scene]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  panel.innerHTML=renderScene(story.scenes[index],index,story.setting,story.place);
  panel.setAttribute('aria-label',story.scenes[index].title);
  if(!motion.matches)panel.animate?.([{opacity:.4},{opacity:1}],{duration:360,easing:'ease-out'});
  if(root.matchMedia('(max-width:700px)').matches)panel.scrollIntoView({block:'start',behavior:'instant'});
 }));
})(typeof window==='object'?window:globalThis);
