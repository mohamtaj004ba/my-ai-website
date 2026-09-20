// CallerCore shared site behavior: navigation, sticky header state, and small accessibility helpers.
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
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape' && nav.classList.contains('open')){
        setOpen(false);menu.focus();
      }
    });
    document.addEventListener('click',e=>{
      if(nav.classList.contains('open') && !header.contains(e.target)) setOpen(false);
    });
  }

  document.querySelectorAll('a[href^="#"],a[href^="/#"]').forEach(a=>{
    a.addEventListener('click',()=>{
      const hash=a.hash;
      if(!hash) return;
      const target=document.querySelector(hash);
      if(target) target.setAttribute('tabindex','-1');
    });
  });
})();