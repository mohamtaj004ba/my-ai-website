// Evidence is scoped: live infrastructure audit is not Preview provider acceptance.
const LIVE_BILLING_AUDIT={at:'2026-10-05',account:'CallerCore LLC',source:'Read-only Stripe connector and signed-in Dashboard inspection; tax/business evidence supplied by TJ',webhook:'https://www.callercore.com/api/stripe-webhook',plans:{Starter:349,Growth:599,Pro:999},setup:500,portalActive:true,taxRegistered:false,checkoutEnabled:false,emailSettings:{successfulPayments:false,refunds:false,trialReminder:false,renewalReminder:false,expiringCards:false,failedCardPayments:false,failedBankPayments:false,hostedAuthenticationLink:false,finalizedInvoices:true,creditNotes:true,unpaidRecurringReminder:false,requiredBankNoticesPreserved:true}};
const SUPPORT_EMAIL_EVIDENCE={at:'2026-10-05',source:'TJ supplied independently verified delivery evidence',address:'support@callercore.com',inbound:true,outbound:true,callerCoreSignin:true,websiteInquiry:true};
const PREVIEW_BILLING_ACCEPTANCE={at:'2026-10-05',scope:'sandbox_card',result:'passed',sha:'70a550d28f45189815e9176c95a72af3c2546b5c',job:'112127970115',source:'docs/STRIPE_SANDBOX_ACCEPTANCE.md',productionAuthorized:false};
function billingAcceptanceServices({previewIsolated=false,scopeHealthy=false}={}){
  const applicable=previewIsolated&&scopeHealthy;
  return [
    {key:'billing-native',name:'Native billing acceptance',status:applicable?'confirmed':'pending',detail:applicable?'Native card purchase, billing controls and payment recovery passed isolated sandbox acceptance. Production checkout remains gated.':'Historical sandbox acceptance is recorded; the current environment must pass its scope checks before that evidence applies.',evidence:PREVIEW_BILLING_ACCEPTANCE},
    {key:'stripe-test-e2e',name:'Stripe sandbox acceptance',status:applicable?'confirmed':'pending',detail:applicable?'Actual sandbox payments, lifecycle webhooks, replay/isolation and recovery passed. This is card-billing evidence, not voice activation or production authorization.':'Sandbox card acceptance does not verify this environment or authorize production sales.',evidence:PREVIEW_BILLING_ACCEPTANCE}
  ];
}
module.exports={LIVE_BILLING_AUDIT,SUPPORT_EMAIL_EVIDENCE,PREVIEW_BILLING_ACCEPTANCE,billingAcceptanceServices};
