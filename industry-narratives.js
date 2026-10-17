/* Every scenario remains readable if JavaScript is unavailable. */
document.querySelectorAll('[data-scenario-selector]').forEach(selector=>{
 const buttons=[...selector.querySelectorAll('[data-scenario]')];
 const panels=[...selector.querySelectorAll('.scenario-panel')];
 function select(button){
  buttons.forEach(item=>item.setAttribute('aria-expanded',String(item===button)));
  panels.forEach(panel=>{panel.hidden=panel.id!==button.getAttribute('aria-controls');});
 }
 buttons.forEach(button=>button.addEventListener('click',()=>select(button)));
 selector.classList.add('is-enhanced');
 select(buttons[0]);
});

// Selection is local illustration, never a simulated live transaction.
document.querySelectorAll('[data-industry-experience]').forEach(experience=>{
 const buttons=[...experience.querySelectorAll('[data-choice]')];
 const panels=[...experience.querySelectorAll('.experience-panel')];
 function select(button){
  buttons.forEach(item=>item.setAttribute('aria-expanded',String(item===button)));
  panels.forEach(panel=>{panel.hidden=panel.id!==button.getAttribute('aria-controls');});
  experience.dataset.selected=button.dataset.choice;
 }
 if(!buttons.length)return;
 buttons.forEach(button=>button.addEventListener('click',()=>select(button)));
 experience.classList.add('is-enhanced');select(buttons[0]);
});

const proofDialog=document.querySelector('#industry-proof-dialog');
if(proofDialog&&typeof proofDialog.showModal==='function'){
 let opener;
 let previousOverflow='';
 const image=proofDialog.querySelector('.proof-dialog-image img');
 document.querySelectorAll('[data-proof-open]').forEach(link=>link.addEventListener('click',event=>{
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
  event.preventDefault();opener=link;
  image.src=link.href;image.alt=link.querySelector('img').alt;
  proofDialog.querySelector('.proof-original').href=link.href;
  if(!proofDialog.open){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
  proofDialog.showModal();proofDialog.querySelector('[data-proof-close]').focus();
 }));
 proofDialog.querySelector('[data-proof-close]').addEventListener('click',()=>proofDialog.close());
 proofDialog.addEventListener('click',event=>{
  const rect=proofDialog.getBoundingClientRect();
  if(event.target===proofDialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))proofDialog.close();
 });
 proofDialog.addEventListener('close',()=>{document.body.style.overflow=previousOverflow;opener?.focus();});
}

// Light emphasis on the timeline; content never depends on viewport observation.
if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
  entry.target.classList.toggle('is-inview',entry.isIntersecting);
 }),{threshold:.3});
 document.querySelectorAll('.timeline-event').forEach(item=>observer.observe(item));
}
