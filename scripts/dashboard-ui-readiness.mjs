// Visual navigation readiness only. View-specific data assertions remain authoritative.
export async function dashboardUiReady({view=null,sidebar=null}={}){
  const ready=()=>{
  const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
  const settled=el=>!el?.getAnimations().some(a=>a.effect?.getTiming().iterations!==Infinity&&a.playState!=='finished'&&a.playState!=='idle');
  const panels=[...document.querySelectorAll('.view.active')];
  if(panels.length!==1||!visible(panels[0])||!settled(panels[0]))return false;
  if(document.fonts&&document.fonts.status!=='loaded')return false;
  if(document.body.classList.contains('client-data-loading')||document.querySelector('.dashboard-main')?.getAttribute('aria-busy')==='true')return false;
  if(view){
    if(panels[0].id!=='view-'+view)return false;
    const navView=view==='conversations'&&document.body.dataset.dashboard==='client'?'contacts':view;
    const nav=document.querySelector('button.nav-item[data-view="'+navView+'"]');
    if(!nav?.classList.contains('active')||nav.getAttribute('aria-current')!=='page')return false;
  }
  if(sidebar){
    const panel=document.querySelector('.sidebar'),menu=document.querySelector('.mobile-menu'),backdrop=document.querySelector('#navigationBackdrop');
    if(!panel||!menu||!backdrop||!settled(panel))return false;
    const open=sidebar==='open';
    if(panel.classList.contains('open')!==open||menu.getAttribute('aria-expanded')!==String(open)||backdrop.hidden===open)return false;
    if(open&&(!visible(panel)||Math.abs(panel.getBoundingClientRect().left)>1))return false;
  }
  return true;
  };
  const geometry=()=>JSON.stringify([...document.querySelectorAll('.view.active,.sidebar,.dashboard-main')].map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}));
  if(!ready())return false;
  const initial=geometry();
  for(let frame=0;frame<3;frame++){
    await new Promise(resolve=>requestAnimationFrame(resolve));
    if(!ready()||geometry()!==initial)return false;
  }
  return true;
}

export async function waitForDashboardUi(page,options={}){
  if(options.view&&!/^[a-z][a-z0-9-]*$/.test(options.view))throw new Error('Invalid dashboard readiness view');
  if(options.sidebar&&!['open','closed'].includes(options.sidebar))throw new Error('Invalid dashboard sidebar readiness');
  // Playwright owns the hard deadline, including a stalled page. No swallowed timeout.
  await page.waitForFunction(dashboardUiReady,options,{polling:'raf',timeout:20000});
}
