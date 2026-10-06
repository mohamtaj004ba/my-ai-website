(function(scope){
  'use strict';
  function presentation(data,verifiedPaid=false){
    if(data.paid&&data.onboarding)return {state:'ready',title:'Welcome to CallerCore.',message:'Your payment is confirmed and your account is ready for our team’s review.',detail:'We’ll email your private onboarding link after review. You can also sign in to see your setup progress.',paid:true,account:true,terminal:true};
    if(data.paid)return {state:'paid',title:'Your payment is confirmed.',message:'We’re preparing your CallerCore account. Your purchase is complete; there’s nothing else to submit.',detail:'This page will update as soon as your account is ready. If setup takes longer, our team can help you check its progress.',paid:true};
    if(verifiedPaid)return presentation({paid:true,onboarding:false});
    if(data.status==='complete')return {state:'processing',title:'Your payment is processing.',message:'Your payment provider is still confirming the transaction. A completed charge has not yet been confirmed.',detail:'We’ll check automatically. Keep this confirmation page handy, or contact our team to check the status of your purchase.'};
    if(data.status==='expired')return {state:'expired',title:'Your checkout has expired.',message:'This checkout closed without a confirmed payment. You can start a new checkout when you’re ready.',detail:'If your bank shows a pending transaction, our team can check it before you start again.',checkout:true,terminal:true};
    if(data.status==='open')return {state:'open',title:'Your checkout is waiting.',message:'Payment hasn’t been completed. Your original checkout is available to continue.',detail:'Return to checkout to review your payment details. If you saw a payment error, its explanation appears alongside your payment form.',checkout:true,terminal:true};
    throw Error('Unrecognized payment status');
  }
  if(typeof module==='object'&&module.exports){module.exports={presentation};return;}
  const $=id=>document.getElementById(id),card=document.querySelector('.confirmation-card'),receipt=new URLSearchParams(location.search).get('receipt');
  let busy=false,verifiedPaid=false,attempts=0,timer=null,finished=false;
  function render(p){
    card.dataset.state=p.state;$('returnTitle').textContent=p.title;$('returnStatus').textContent=p.message;$('confirmationDetail').textContent=p.detail;
    $('accountLink').hidden=!p.account;$('checkoutLink').hidden=!p.checkout;$('checkConfirmation').hidden=!!p.terminal;
    $('paymentStep').classList.toggle('complete',!!p.paid);$('accountStep').classList.toggle('complete',!!p.account);
    $('nextHeading').textContent=p.paid?'We’ll take it from here.':'Your setup, step by step.';
    $('paymentStepText').textContent=p.paid?'Payment confirmed. Your purchase is complete.':({processing:'Awaiting your payment provider’s confirmation.',expired:'This checkout has expired without a confirmed payment.',open:'Your original checkout is available to complete.',link:'Your confirmation is available in your original checkout browser.',unavailable:'Confirmation is temporarily unavailable.'}[p.state]||'Securely confirming your purchase.');
    $('accountStepText').textContent=p.account?'Your account is ready. Our team will review your setup.':'Our team reviews your business details and prepares your setup.';
  }
  function unavailable(){
    render(verifiedPaid?presentation({paid:true,onboarding:false}):{state:'unavailable',title:'We’re checking your payment status.',message:'We couldn’t reach payment confirmation just now. That connection issue doesn’t tell us whether your payment succeeded.',detail:'Check the status again here, or contact our team to confirm your purchase before starting a new checkout.'});
    $('checkNote').textContent=verifiedPaid?'Payment remains confirmed. Account status is temporarily unavailable.':'Payment status is temporarily unavailable.';
  }
  async function check(manual=false){
    if(busy||finished)return;clearTimeout(timer);busy=true;$('checkConfirmation').disabled=true;$('checkConfirmation').textContent='Checking…';
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch('/api/create-checkout-session?receipt='+encodeURIComponent(receipt),{headers:{Accept:'application/json'},signal:controller.signal}),data=await response.json().catch(()=>null);
      if(response.status===403&&!verifiedPaid){finished=true;render({state:'link',title:'Your confirmation is private.',message:'Open this link in the browser where you completed checkout.',detail:'This protects your payment details. If you’re using another device, our team can help you find your purchase.',terminal:true});return;}
      if(!response.ok||!data||typeof data.paid!=='boolean'||typeof data.onboarding!=='boolean')throw Error('Unverified confirmation');
      const p=presentation(data,verifiedPaid);verifiedPaid=verifiedPaid||!!p.paid;render(p);finished=!!p.terminal;
      if(p.paid){$('confirmationReceipt').hidden=false;$('receiptPlan').textContent=['Starter','Growth','Pro'].includes(data.plan)?data.plan+' plan':'CallerCore plan';
        if(Number.isSafeInteger(data.amountTotal)&&data.amountTotal>=0&&/^[a-z]{3}$/i.test(data.currency||'')){try{$('receiptAmount').textContent=new Intl.NumberFormat(undefined,{style:'currency',currency:data.currency}).format(data.amountTotal/100);$('receiptAmountRow').hidden=false;}catch(_){}}
      }
      if(p.account)sessionStorage.removeItem('cc_checkout_attempt');
      $('checkNote').textContent=finished?'':'Last checked '+new Date().toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})+'.';
    }catch(_){unavailable();}finally{clearTimeout(timeout);busy=false;$('checkConfirmation').disabled=false;$('checkConfirmation').textContent='Check status';}
    if(!finished&&++attempts<12)timer=setTimeout(check,Math.min(1500*Math.pow(1.5,attempts-1),15000));
    else if(!finished)$('checkNote').textContent=verifiedPaid?'Your payment is confirmed. You can check account setup again here, or contact our team.':'You can check again here whenever you’re ready. Our team can also help confirm your purchase.';
  }
  $('checkConfirmation').addEventListener('click',()=>{attempts=0;check(true);});
  $('checkoutLink').addEventListener('click',()=>{if(card.dataset.state==='expired')sessionStorage.removeItem('cc_checkout_attempt');});
  scope.addEventListener('online',()=>{if(!finished){attempts=0;check();}});
  if(!/^[a-f0-9]{48}$/.test(receipt||'')){finished=true;render({state:'link',title:'Let’s find your confirmation.',message:'This page needs the private confirmation link from your checkout.',detail:'Open that link in the browser you used for payment, or contact our team and we’ll help locate your purchase.',terminal:true});return;}
  check();
})(typeof window!=='undefined'?window:globalThis);
