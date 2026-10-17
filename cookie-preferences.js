(function(){
 'use strict';
 const key='cc_cookie_choice',version=1,maxAge=180*86400000;
 let allowed=false;
 try{const saved=JSON.parse(localStorage.getItem(key));allowed=saved?.version===version&&Date.now()-saved.at<maxAge&&saved.analytics===true;}catch(_){}
 const gpc=navigator.globalPrivacyControl===true;
 if(gpc)allowed=false;
 window.CallerCorePrivacy={analytics:allowed,openPreferences};
 if(!allowed){try{localStorage.removeItem('cc_vid');sessionStorage.removeItem('cc_sid');}catch(_){}}
 const style=document.createElement('link');style.rel='stylesheet';style.href='/cookie-preferences.css';document.head.append(style);
 let panel=null,opener=null;
 function openPreferences(){
  if(panel){panel.focus();return;}
  opener=document.activeElement;
  panel=document.createElement('dialog');panel.className='cookie-panel';panel.setAttribute('aria-labelledby','cookie-title');
  panel.innerHTML='<button class="cookie-close" type="button" aria-label="Close cookie preferences">×</button><p class="cookie-eyebrow">YOUR CHOICE</p><h2 id="cookie-title">Cookie preferences</h2><p>Essential storage supports sign-in and your saved preferences. Optional analytics is off unless you choose to allow it. You can use the website either way.</p><p class="cookie-current">'+(gpc?'Your browser’s Global Privacy Control keeps optional analytics off.':window.CallerCorePrivacy.analytics?'Your current choice: optional analytics allowed.':'Your current choice: essential storage only.')+'</p><div class="cookie-actions"><button type="button" data-cookie="false">Essential only</button><button type="button" data-cookie="true"'+(gpc?' disabled':'')+'>Allow analytics</button></div><a href="/cookies">Read our cookie policy</a>';
  const activePanel=panel;
  activePanel.addEventListener('close',()=>{activePanel.remove();panel=null;if(opener?.isConnected)opener.focus();});
  activePanel.querySelector('.cookie-close').addEventListener('click',()=>activePanel.close());
  activePanel.querySelectorAll('[data-cookie]').forEach(button=>button.addEventListener('click',()=>{
   const analytics=button.dataset.cookie==='true'&&!gpc;
   window.CallerCorePrivacy.analytics=analytics;
   try{localStorage.setItem(key,JSON.stringify({version,at:Date.now(),analytics}));if(!analytics){localStorage.removeItem('cc_vid');sessionStorage.removeItem('cc_sid');}}catch(_){}
   window.dispatchEvent(new CustomEvent('callercoreprivacychange',{detail:{analytics}}));
   activePanel.close();
  }));
  document.body.append(activePanel);activePanel.showModal();
 }
 document.querySelectorAll('[data-cookie-settings]').forEach(button=>button.addEventListener('click',openPreferences));
})();
