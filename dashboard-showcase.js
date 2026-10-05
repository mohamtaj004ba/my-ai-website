(()=>{
 const section=document.querySelector('.dashboard-showcase');if(!section)return;
 const image=section.querySelector('.dashboard-image-button img'),dialog=section.querySelector('dialog'),fullImage=dialog.querySelector('img'),title=section.querySelector('[data-dashboard-title]'),caption=section.querySelector('[data-dashboard-caption]');
 const views={today:['Today','See the day at a glance: incoming calls, captured requests, activity trends, and the follow-ups waiting for your team.'],calls:['Call history','Review who called, what they needed, and the outcome of each conversation.'],contacts:['Contacts','Keep contact information and call history together, ready when your team needs them.'],'follow-ups':['Follow-ups','Work through captured requests with clear priorities and follow-up status.']};
 let active='today',trigger;
 const update=key=>{active=key;const [name,description]=views[key];image.src='/assets/dashboard/'+key+'.png';image.alt='CallerCore '+name+' dashboard with sample workspace data';title.textContent=name+' dashboard';caption.textContent=description;section.querySelectorAll('[data-dashboard-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.dashboardView===key)))};
 section.querySelectorAll('[data-dashboard-view]').forEach(button=>button.addEventListener('click',()=>update(button.dataset.dashboardView)));
 section.querySelectorAll('[data-dashboard-expand]').forEach(button=>button.addEventListener('click',()=>{trigger=button;fullImage.src=image.src;fullImage.alt=image.alt;dialog.querySelector('[data-full-title]').textContent=views[active][0]+' · sample workspace';dialog.showModal();dialog.scrollTop=0;dialog.querySelector('button').focus()}));
 dialog.querySelector('button').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>trigger?.focus());
})();
