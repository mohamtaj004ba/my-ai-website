const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');

const actionStart=source.indexOf('function onboardingNeedsAction('),actionEnd=source.indexOf('\nfunction closeOnboardingDrawer(',actionStart);
const actionCode=source.slice(actionStart,actionEnd);
test('onboarding next action distinguishes failed, sending and uncertain invite delivery',()=>{
  const ctx=vm.createContext({Date});
  vm.runInContext(actionCode,ctx);
  const base={stage:'Review',onboardingStatus:'awaiting_review',reviewEligibleAt:0,onboardingLinkSent:false,checklist:{}};
  assert.equal(vm.runInContext('onboardingNextAction',ctx)({...base,inviteDeliveryStatus:'failed'}).label,'Retry onboarding invite');
  assert.equal(vm.runInContext('onboardingNextAction',ctx)({...base,inviteDeliveryStatus:'sending'}).label,'Sending onboarding…');
  assert.equal(vm.runInContext('onboardingNextAction',ctx)({...base,inviteDeliveryStatus:'uncertain',inviteDeliveryNeedsReview:true}).type,'delivery-review');
  assert.equal(vm.runInContext('onboardingNeedsAction',ctx)({...base,inviteDeliveryNeedsReview:true}),true);
});

test('delivery-review UI requires an explicit Mailgun-confirmed resolution',()=>{
  assert.match(source,/data-resolve-onboarding-delivery="sent"/);
  assert.match(source,/data-resolve-onboarding-delivery="not_sent"/);
  assert.match(source,/Only mark this invite as sent after confirming Mailgun accepted or delivered it/);
  assert.match(source,/Only mark this invite as not sent after confirming Mailgun did not accept or deliver it/);
  assert.match(source,/admin-onboarding-delivery-resolve/);
});

test('onboarding invite and delivery resolution share a per-client pending lock',()=>{
  assert.match(source,/adminOnboardingInvitePending=new Set\(\)/);
  assert.match(source,/if\(adminOnboardingInvitePending\.has\(key\)\)return false/);
  assert.match(source,/setOnboardingInviteControls\(key,true\)/);
  assert.match(source,/adminOnboardingInvitePending\.delete\(key\)/);
});

test('send UI refreshes authoritative onboarding state after failed or ambiguous delivery',()=>{
  const start=source.indexOf('async function sendOnboardingInvite('),end=source.indexOf('\nasync function approveProvisioningBuild(',start),body=source.slice(start,end);
  assert.match(body,/if\(!r\.ok\)[\s\S]*refreshAdminView\('onboarding'/);
  assert.match(body,/data\.ok!==true/);
  assert.match(body,/!data\.onboarding\|\|typeof data\.onboarding!=='object'/);
  assert.match(body,/data\.deliveryStatus!=='sent'&&data\.alreadySent!==true/);
  assert.match(body,/finally\{adminOnboardingInvitePending\.delete/);
});


test('onboarding filters expose selected state beyond visual styling',()=>{
  assert.match(source,/data-onboarding-filter[\s\S]*setAttribute\('aria-pressed',String\(selected\)\)/);
});


test('onboarding empty state distinguishes filters from a truly empty source',()=>{
  assert.match(source,/all\.length\?'[<]div class="empty-state"[>][<]h3[>]No onboarding accounts match this view/);
  assert.match(source,/No onboarding accounts yet/);
});


test('onboarding operational feedback is inline while delivery resolution keeps confirmation',()=>{
  const html=fs.readFileSync('admin-dashboard.html','utf8');
  assert.match(html,/id="onboardingActionStatus" role="status" aria-live="polite" aria-atomic="true"/);
  const start=source.indexOf('async function sendOnboardingInvite('),end=source.indexOf('\nlet phoneVisibleLimit=50,',start),block=source.slice(start,end);
  assert.match(source,/function setOnboardingActionStatus\(message='',tone=''\)/);
  assert.doesNotMatch(block,/\balert\s*\(/);
  assert.match(block,/if\(!confirm\(message\)\)return false/);
  assert.match(block,/setOnboardingActionStatus\('Sending onboarding invite…'\)/);
  assert.match(block,/setOnboardingActionStatus\('Saving delivery resolution…'\)/);
  assert.match(block,/setOnboardingActionStatus\('Approving build…'\)/);
  assert.match(block,/setOnboardingActionStatus\('Saving checklist update…'\)/);
  assert.match(block,/setOnboardingActionStatus\('Saving onboarding stage…'\)/);
  assert.match(block,/setOnboardingActionStatus\('Restoring automatic stage…'\)/);
});
