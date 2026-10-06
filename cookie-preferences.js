(function(){
 const key='cc_cookie_choice',version=1,maxAge=180*86400000;
 let choice=null;try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.version===version&&Date.now()-saved.at<maxAge&&typeof saved.analytics==='boolean')choice=saved.analytics;}catch(_){}
 if(navigator.globalPrivacyControl===true)choice=false;
 window.CallerCorePrivacy={analytics:choice===true};
 const style=document.createElement('link');style.rel='stylesheet';style.href='/cookie-preferences.css';document.head.append(style);
 const panel=document.createElement('section');panel.className='cookie-panel';panel.setAttribute('aria-label','Cookie preferences');panel.hidden=choice!==null;
 panel.innerHTML='<div><strong>Your privacy choices</strong><p>Essential storage keeps the site and sign-in working. Optional analytics helps us understand visits. You can browse without it. <a href="/cookies">Cookie details</a></p></div><div class="cookie-actions"><button type="button" data-cookie="false">Essential only</button><button type="button" data-cookie="true">Allow analytics</button></div>';
 document.body.append(panel);
 const reopen=document.createElement('button');reopen.type='button';reopen.className='cookie-settings';reopen.textContent='Cookie settings';reopen.addEventListener('click',()=>{panel.hidden=false;panel.querySelector('button').focus();});document.body.append(reopen);
 function save(allowed){window.CallerCorePrivacy.analytics=allowed;try{localStorage.setItem(key,JSON.stringify({version,at:Date.now(),analytics:allowed}));if(!allowed){localStorage.removeItem('cc_vid');sessionStorage.removeItem('cc_sid');}}catch(_){}panel.hidden=true;window.dispatchEvent(new CustomEvent('callercoreprivacychange',{detail:{analytics:allowed}}));reopen.focus();}
 panel.querySelectorAll('[data-cookie]').forEach(button=>button.addEventListener('click',()=>save(button.dataset.cookie==='true'&&navigator.globalPrivacyControl!==true)));
 if(navigator.globalPrivacyControl===true)save(false);
})();
