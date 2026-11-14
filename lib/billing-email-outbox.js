const crypto=require('crypto');
const {compareAndSetConfig}=require('./config-transaction');
const {lifecycleEmail,esc}=require('./email-template');
const keyFor=id=>'billing:email:'+crypto.createHash('sha256').update(id).digest('hex');
function billingEmailRecord({operationId,workspaceId,to,type,plan,previousPlan,amount,effectiveAt,payment,siteUrl='https://www.callercore.com'}){
  const titles={purchase:'Payment received. Welcome to CallerCore.',active:'Your subscription is active.',contact:'Your billing contact has been updated.',plan:'Your CallerCore plan has changed.',payment:'Your payment method has been updated.',failed:'Your payment needs attention.',recovered:'Your payment is confirmed.',cancel:'Your cancellation is scheduled.',reactivate:'Your subscription will continue.',ended:'Your subscription has ended.',invoice:'Your invoice is paid.'};
  if(!titles[type]||!operationId||!workspaceId||!/^\S+@\S+\.\S+$/.test(to))throw Error('Invalid billing email event');
  const date=effectiveAt?new Date(effectiveAt*1000).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):null;
  const details=[plan&&'Plan: '+plan,previousPlan&&'Previous plan: '+previousPlan,Number.isSafeInteger(amount)&&'Amount: '+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount/100),date&&'Billing date: '+date,payment?.last4&&'Payment method: '+payment.brand+' ending in '+payment.last4].filter(Boolean);
  const note=type==='purchase'?'Your $500 one-time setup fee and monthly plan are confirmed. Managed onboarding begins with account review. Your phone number and receptionist are not live yet.':type==='cancel'?'Your service continues through the cancellation date. You can keep your subscription from CallerCore Billing before that date. Workspace deletion is a separate process.':type==='failed'?'Open CallerCore Billing to update your payment method or contact support.':type==='ended'?'Subscription billing has ended. Your workspace data follows the separate account retention policy. Contact CallerCore if you need help.':'View your current subscription and official invoices in CallerCore Billing.';
  const email=lifecycleEmail({eyebrow:'CALLERCORE BILLING',title:titles[type],intro:details.map(esc).join('<br>'),bodyHtml:'<p>'+esc(note)+'</p>',ctaLabel:'Open CallerCore Billing',ctaUrl:siteUrl+'/dashboard?view=billing',siteUrl});
  return {operationId,workspaceId,to,type,subject:titles[type],...email,status:'queued',createdAt:Date.now()};
}
async function enqueueBillingEmail(kv,event){
  const key=keyFor(event.operationId),existing=await kv.get(key);
  if(existing){if(existing.operationId!==event.operationId||existing.workspaceId!==event.workspaceId||existing.type!==event.type)throw Error('Billing email identity conflict');return {key,record:existing}}
  const record=billingEmailRecord(event);
  if(!await compareAndSetConfig(kv,[{key,before:null,after:record}]))return enqueueBillingEmail(kv,event);
  return {key,record};
}
async function enqueueRenderedBillingEmail(kv,{operationId,workspaceId,to,subject,text,html}){
  if(!operationId||!workspaceId||!/^\S+@\S+\.\S+$/.test(to)||!subject||!text||!html)throw Error('Invalid rendered billing message');
  const key=keyFor(operationId),existing=await kv.get(key);if(existing){if(existing.workspaceId!==workspaceId||existing.to!==to)throw Error('Billing email identity conflict');return {key,record:existing}}
  const record={operationId,workspaceId,to,subject,text,html,type:'purchase',status:'queued',createdAt:Date.now()};
  if(!await compareAndSetConfig(kv,[{key,before:null,after:record}]))return enqueueRenderedBillingEmail(kv,{operationId,workspaceId,to,subject,text,html});
  return {key,record};
}
async function deliverBillingEmail(kv,key,send,env=process.env){
  const record=await kv.get(key);if(!record)throw Error('Billing email not found');
  if(['sent','captured','uncertain','sending'].includes(record.status))return record;
  if(!['queued','failed'].includes(record.status))throw Error('Invalid billing email state');
  // Preview captures messages. Live delivery is separately gated until duplication settings are accepted.
  if(env.VERCEL_ENV==='preview'||env.CALLERCORE_BILLING_EMAILS_ENABLED!=='true'){
    const after={...record,status:env.VERCEL_ENV==='preview'?'captured':'queued',capturedAt:env.VERCEL_ENV==='preview'?Date.now():null};
    if(!await compareAndSetConfig(kv,[{key,before:record,after}]))throw Error('Billing email capture conflict');return after;
  }
  const sending={...record,status:'sending',attemptedAt:Date.now()};
  if(!await compareAndSetConfig(kv,[{key,before:record,after:sending}]))throw Error('Billing email delivery is already claimed');
  let after;
  try{const receipt=await send({to:record.to,subject:record.subject,text:record.text,html:record.html});if(!receipt?.id)throw Object.assign(Error('Unverified delivery'),{deliveryState:'uncertain'});after={...sending,status:'sent',providerMessageId:receipt.id,sentAt:Date.now()}}
  catch(error){after={...sending,status:error.deliveryState==='failed'?'failed':'uncertain',failedAt:Date.now()}}
  // A crash/ambiguous ACK remains sending/uncertain for review, never blind resend.
  if(!await compareAndSetConfig(kv,[{key,before:sending,after}]))throw Error('Billing email receipt requires reconciliation');return after;
}
module.exports={keyFor,billingEmailRecord,enqueueBillingEmail,enqueueRenderedBillingEmail,deliverBillingEmail};
