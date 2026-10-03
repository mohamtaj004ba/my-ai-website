(()=>{
  const modalState=new WeakMap();
  const selector='button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function isRendered(element){
    if(element.hidden||(typeof element.closest==='function'&&element.closest('[hidden],[aria-hidden="true"]')))return false;
    const view=element.ownerDocument?.defaultView||globalThis;
    const style=typeof view.getComputedStyle==='function'?view.getComputedStyle(element):null;
    return (!style||(style.display!=='none'&&style.visibility!=='hidden'))&&(!element.getClientRects||element.getClientRects().length>0);
  }

  function focusable(modal){
    return [...modal.querySelectorAll(selector)].filter(isRendered);
  }

  function isOpen(modal){return modal.classList.contains('open')&&modal.getAttribute('aria-hidden')!=='true'}

  function sync(modal){
    const state=modalState.get(modal),open=isOpen(modal);
    if(open===state.open)return;
    state.open=open;
    if(open){
      const active=document.activeElement;
      state.returnFocus=active&&active!==document.body&&!modal.contains(active)?active:null;
      queueMicrotask(()=>{
        if(!isOpen(modal)||modal.contains(document.activeElement))return;
        (focusable(modal)[0]||modal).focus();
      });
    }else{
      const target=state.returnFocus;state.returnFocus=null;
      if(target&&target.isConnected&&typeof target.focus==='function'&&!target.hasAttribute?.('disabled')&&isRendered(target))queueMicrotask(()=>target.focus());
    }
  }

  function onKeydown(event){
    const modal=event.currentTarget;if(!isOpen(modal))return;
    if(event.key==='Escape'){
      const close=modal.querySelector('.modal-close:not([disabled]),[aria-label^="Close"]:not([disabled])');
      if(close){event.preventDefault();event.stopPropagation();close.click()}
      return;
    }
    if(event.key!=='Tab')return;
    const items=focusable(modal);
    if(!items.length){event.preventDefault();modal.focus();return}
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }

  document.querySelectorAll('.modal,.call-drawer,.onboarding-detail-drawer,.admin-ai-panel').forEach((modal,index)=>{
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.tabIndex=-1;
    const title=modal.querySelector('h1,h2,h3');
    if(title){if(!title.id)title.id=(modal.id||'dialog-'+index)+'-title';modal.setAttribute('aria-labelledby',title.id)}
    modalState.set(modal,{open:false,returnFocus:null});
    modal.addEventListener('keydown',onKeydown);
    new MutationObserver(()=>sync(modal)).observe(modal,{attributes:true,attributeFilter:['class','aria-hidden']});
    sync(modal);
  });
})();
