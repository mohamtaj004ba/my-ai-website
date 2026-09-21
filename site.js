// CallerCore shared site behavior + first-party analytics.
(function(){
  const header=document.querySelector('.site-header');
  const menu=document.querySelector('.menu');
  const nav=document.getElementById('primary-nav') || document.querySelector('.site-header nav');

  if(header){
    const updateHeader=()=>header.classList.toggle('scrolled',window.scrollY>8);
    updateHeader();
    window.addEventListener('scroll',updateHeader,{passive:true});
  }

  if(menu && nav){
    menu.setAttribute('aria-controls',nav.id || 'primary-nav');
    if(!nav.id) nav.id='primary-nav';
    menu.setAttribute('aria-expanded','false');
    const setOpen=(open)=>{
      nav.classList.toggle('open',open);
      menu.setAttribute('aria-expanded',String(open));
      menu.textContent=open?'Close':'Menu';
      document.body.classList.toggle('nav-open',open);
    };
    menu.addEventListener('click',()=>setOpen(!nav.classList.contains('open')));
    nav.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false)});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){setOpen(false);menu.focus()}});
    document.addEventListener('click',e=>{if(nav.classList.contains('open')&&!header.contains(e.target))setOpen(false)});
  }

  document.querySelectorAll('a[href^="#"],a[href^="/#"]').forEach(a=>{
    a.addEventListener('click',()=>{const hash=a.hash;if(!hash)return;const target=document.querySelector(hash);if(target)target.setAttribute('tabindex','-1')});
  });

  // First-party analytics. No form field values or sensitive input are captured here.
  const uuid=()=>{try{return crypto.randomUUID()}catch(_){return Date.now().toString(36)+Math.random().toString(36).slice(2)}};
  let visitorId;
  try{visitorId=localStorage.getItem('cc_vid')||uuid();localStorage.setItem('cc_vid',visitorId)}catch(_){visitorId=uuid()}
  let sessionId;
  try{sessionId=sessionStorage.getItem('cc_sid')||uuid();sessionStorage.setItem('cc_sid',sessionId)}catch(_){sessionId=uuid()}
  const q=new URLSearchParams(location.search);
  const ctx={
    visitorId,sessionId,path:location.pathname+location.search,title:document.title,
    referrer:document.referrer||'',
    utmSource:q.get('utm_source')||'',utmMedium:q.get('utm_medium')||'',utmCampaign:q.get('utm_campaign')||'',
    source:q.get('utm_source')||((document.referrer&&new URL(document.referrer,location.href).hostname!==location.hostname)?'referral':'direct'),
    device:/Mobi|Android/i.test(navigator.userAgent)?'mobile':(/Tablet|iPad/i.test(navigator.userAgent)?'tablet':'desktop')
  };
  const payload=(type,extra={})=>({...ctx,type,...extra});
  const send=(type,extra={},beacon=false)=>{
    const body=JSON.stringify(payload(type,extra));
    try{
      if(beacon&&navigator.sendBeacon){navigator.sendBeacon('/api/site-track',new Blob([body],{type:'application/json'}));return}
      fetch('/api/site-track',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:beacon}).catch(()=>{})
    }catch(_){}
  };
  window.CallerCoreAnalytics={track:send,context:ctx};

  send('session_start');send('page_view');
  let activeSince=Date.now(),activeAccum=0,lastFlush=Date.now();
  const markInactive=()=>{if(activeSince){activeAccum+=Date.now()-activeSince;activeSince=0}};
  const markActive=()=>{if(!activeSince)activeSince=Date.now()};
  document.addEventListener('visibilitychange',()=>{document.hidden?markInactive():markActive()});
  window.addEventListener('blur',markInactive);window.addEventListener('focus',markActive);
  const flushEngagement=(final=false)=>{
    if(activeSince){activeAccum+=Date.now()-activeSince;activeSince=Date.now()}
    if(activeAccum>0){send(final?'page_exit':'engagement',{activeMs:activeAccum},final);activeAccum=0;lastFlush=Date.now()}
    else if(final)send('page_exit',{activeMs:0},true);
  };
  setInterval(()=>{if(Date.now()-lastFlush>=15000)flushEngagement(false)},15000);
  window.addEventListener('pagehide',()=>flushEngagement(true));

  document.addEventListener('click',e=>{
    const a=e.target.closest('a,button');if(!a)return;
    let label=(a.getAttribute('data-analytics-label')||a.textContent||a.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,160);
    let value='';
    if(a.matches('[data-plan]')){send('plan_select',{label:'plan',value:a.dataset.plan||''});return}
    if(a.tagName==='A')value=a.getAttribute('href')||'';
    if(value||label)send('cta_click',{label,value});
  });

  document.querySelectorAll('form').forEach(form=>{
    let started=false,submitted=false;
    const id=form.id||form.getAttribute('name')||'form';
    const start=()=>{if(started)return;started=true;send('form_start',{label:id})};
    form.addEventListener('focusin',start,{once:true});
    form.addEventListener('input',start,{once:true});
    form.addEventListener('submit',()=>{started=true;submitted=true;send('form_submit',{label:id})});
    window.addEventListener('pagehide',()=>{if(started&&!submitted)send('form_abandon',{label:id},true)});
  });
})();