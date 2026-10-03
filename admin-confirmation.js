let adminActionConfirmationState=null;
function adminActionConfirmationStatus(message,error=false){
  const node=document.getElementById('adminActionConfirmationStatus');
  if(node){node.textContent=message||'';node.classList.toggle('error-text',error)}
}
function adminActionConfirmationPending(pending){
  document.getElementById('adminActionConfirmationModal')?.setAttribute('aria-busy',String(pending));
  for(const id of ['closeAdminActionConfirmation','cancelAdminActionConfirmation','submitAdminActionConfirmation']){
    const node=document.getElementById(id);if(node)node.disabled=pending;
  }
  const submit=document.getElementById('submitAdminActionConfirmation');if(submit)submit.textContent=pending?'Working…':adminActionConfirmationState?.action||'Confirm';
}
function closeAdminActionConfirmation(){
  if(adminActionConfirmationState?.pending)return false;
  adminActionConfirmationState=null;
  const modal=document.getElementById('adminActionConfirmationModal');modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true');adminActionConfirmationStatus('');return true;
}
function openAdminActionConfirmation(spec){
  const modal=document.getElementById('adminActionConfirmationModal');
  if(!modal||adminActionConfirmationState)return false;
  adminActionConfirmationState={...spec,pending:false};
  for(const [id,value] of [['adminActionConfirmationTitle',spec.title],['adminActionConfirmationCopy',spec.copy],['adminActionConfirmationConsequences',spec.consequences]]){
    const node=document.getElementById(id);if(node)node.textContent=value||'';
  }
  const review=document.getElementById('adminActionConfirmationReview'),reviewCopy=document.getElementById('adminActionConfirmationReviewCopy');
  if(review)review.hidden=!spec.review;if(reviewCopy)reviewCopy.textContent=spec.review||'';
  adminActionConfirmationPending(false);adminActionConfirmationStatus('');modal.classList.add('open');modal.setAttribute('aria-hidden','false');return true;
}
async function submitAdminActionConfirmation(){
  const state=adminActionConfirmationState;if(!state||state.pending)return false;
  const invalid=state.validate();if(invalid){adminActionConfirmationStatus(invalid,true);return false}
  state.pending=true;adminActionConfirmationPending(true);adminActionConfirmationStatus('Applying the confirmed action…');
  try{
    const ok=await state.run();
    if(ok!==true){adminActionConfirmationStatus(state.failureMessage?.()||'The action was not confirmed. Review the error before retrying.',true);return false}
    state.pending=false;closeAdminActionConfirmation();return true;
  }catch(error){adminActionConfirmationStatus(error.message||'The action was not confirmed. Review its status before retrying.',true);return false}
  finally{state.pending=false;adminActionConfirmationPending(false)}
}
document.getElementById('closeAdminActionConfirmation')?.addEventListener('click',closeAdminActionConfirmation);
document.getElementById('cancelAdminActionConfirmation')?.addEventListener('click',closeAdminActionConfirmation);
document.getElementById('submitAdminActionConfirmation')?.addEventListener('click',submitAdminActionConfirmation);
