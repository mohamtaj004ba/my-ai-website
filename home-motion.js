/* Illustrative reception workflow only. No API calls or real activity. */
(function(){
 'use strict';
 const scene=document.getElementById('reception-scene');if(!scene)return;
 const states=['Incoming call','CallerCore is answering','Details captured','Follow-up prepared'];
 const descriptions=['A new conversation begins.','A familiar welcome. The right questions.','The important details, together.','Your team has a clear next step.'];
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let step=motion.matches?3:0,paused=motion.matches,visible=true,timer=null;
 const button=document.getElementById('scene-toggle');
 function render(){
  scene.dataset.step=String(step);scene.dataset.playing=String(!paused&&visible&&!document.hidden&&!motion.matches);
  document.getElementById('scene-status').textContent=states[step];
  document.getElementById('scene-caption').textContent=descriptions[step];
  document.querySelectorAll('.scene-steps li').forEach((el,i)=>{el.classList.toggle('current',i===step);el.classList.toggle('complete',i<step)});
  button.disabled=motion.matches;button.textContent=motion.matches?'Static example':paused?'Replay example':'Pause animation';button.setAttribute('aria-pressed',String(!paused));
 }
 function schedule(){clearTimeout(timer);render();if(paused||!visible||document.hidden||motion.matches)return;timer=setTimeout(()=>{step=(step+1)%4;schedule()},4500)}
 button.addEventListener('click',()=>{if(motion.matches)return;if(paused){step=0;paused=false}else paused=true;schedule()});
 document.addEventListener('visibilitychange',schedule);
 window.addEventListener('pagehide',()=>clearTimeout(timer));
 motion.addEventListener('change',()=>{paused=motion.matches;step=motion.matches?3:0;schedule()});
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule()},{threshold:.15}).observe(scene);
 schedule();
 const elements=document.querySelectorAll('.how-wrap .flow article,.feature-grid article');
 if(!motion.matches&&'IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('motion-entered');observer.unobserve(entry.target)}}),{threshold:.15});elements.forEach(el=>{el.classList.add('motion-ready');observer.observe(el)})}
})();
