(()=>{
  const modalState=new WeakMap();
  const selector='button:not([disabled]):not([aria-disabled="true"]),a[href]:not([tabindex="-1"]):not([aria-disabled="true"]),input:not([disabled]):not([aria-disabled="true"]),select:not([disabled]):not([aria-disabled="true"]),textarea:not([disabled]):not([aria-disabled="true"]),[tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])';

  function isRendered(element){
    if(element.hidden||element.getAttribute?.('aria-disabled')==='true'||(typeof element.closest==='function'&&element.closest('[hidden],[aria-hidden="true"]')))return false;
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
      if(!state.returnFocus)state.returnFocus=active&&active!==document.body&&!modal.contains(active)?active:null;
      queueMicrotask(()=>{
        if(!isOpen(modal)||modal.contains(document.activeElement))return;
        (focusable(modal)[0]||modal).focus();
      });
    }else{
      const target=state.returnFocus;
      const successor=dialogs.find(other=>other!==modal&&isOpen(other));
      if(successor&&target){
        const successorState=modalState.get(successor);
        if(successorState&&(!successorState.returnFocus||modal.contains(successorState.returnFocus))){
          successorState.returnFocus=target;state.returnFocus=null;return;
        }
      }
      state.returnFocus=null;
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
    const first=items[0],last=items[items.length-1],active=document.activeElement;
    if(!modal.contains(active)){event.preventDefault();(event.shiftKey?last:first).focus();return}
    if(event.shiftKey&&active===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&active===last){event.preventDefault();first.focus()}
  }

  const dialogs=[...document.querySelectorAll('.modal,.call-drawer,.onboarding-detail-drawer,.admin-ai-panel')];
  dialogs.forEach((modal,index)=>{
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.tabIndex=-1;
    const title=modal.querySelector('h1,h2,h3');
    if(title){if(!title.id)title.id=(modal.id||'dialog-'+index)+'-title';modal.setAttribute('aria-labelledby',title.id)}
    modalState.set(modal,{open:false,returnFocus:null});
    modal.addEventListener('keydown',onKeydown);
    new MutationObserver(()=>sync(modal)).observe(modal,{attributes:true,attributeFilter:['class','aria-hidden']});
    sync(modal);
  });
})();
